import { validateSessionPayload } from "@shared/sessionPayload"
import type { SessionCommitPayload } from "@shared/provider"

import { ApiError } from "./client"

/**
 * The pending-commit outbox: finished sessions that the Worker has not
 * confirmed yet, kept in `localStorage` until a drain succeeds.
 *
 * It stores only the payload. Nothing is retried that the server could not
 * possibly accept — a payload that no longer validates, or one the server
 * refuses with a 4xx, is dropped rather than retried forever.
 */

export const OUTBOX_KEY = "words-wizard.pendingCommits"

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PendingCommit {
  readonly payload: SessionCommitPayload
  readonly queuedAt: number
}

export interface DrainReport {
  /** Session ids the server confirmed and removed. */
  readonly sent: readonly string[]
  /** Session ids dropped because they could never be accepted. */
  readonly dropped: readonly string[]
  /** Session ids still waiting, in queue order. */
  readonly remaining: readonly string[]
  /** A 401 paused the drain; the caller must re-authenticate first. */
  readonly unauthorized: boolean
}

type StoredEntry = { payload: SessionCommitPayload; queuedAt: number }

export class Outbox {
  constructor(
    private readonly storage: StorageLike,
    private readonly key: string = OUTBOX_KEY,
  ) {}

  /** Every pending commit, oldest first. */
  all(): PendingCommit[] {
    return Object.entries(this.read()).map(([, entry]) => entry)
  }

  /**
   * Park one finished session. Keyed by the session id, so a retry that
   * already reached the server still leaves exactly one entry.
   */
  enqueue(payload: SessionCommitPayload, queuedAt = Date.now()): void {
    const entries = this.read()

    entries[payload.session.id] = { payload, queuedAt }
    this.write(entries)
  }

  remove(sessionId: string): void {
    const entries = this.read()

    if (sessionId in entries) {
      delete entries[sessionId]
      this.write(entries)
    }
  }

  clear(): void {
    this.write({})
  }

  /**
   * Send every pending commit, oldest first, and stop at the first failure
   * that might pass later. An invalid or refused payload is removed and
   * reported; a network failure, a 5xx, or a 401 leaves the queue intact.
   */
  async drain(
    send: (payload: SessionCommitPayload) => Promise<void>,
  ): Promise<DrainReport> {
    const entries = this.read()
    const ordered = Object.entries(entries).sort(
      ([leftId, left], [rightId, right]) =>
        left.queuedAt - right.queuedAt || leftId.localeCompare(rightId),
    )

    const sent: string[] = []
    const dropped: string[] = []
    let unauthorized = false

    for (const [sessionId, entry] of ordered) {
      if (validateSessionPayload(entry.payload).length > 0) {
        delete entries[sessionId]
        dropped.push(sessionId)
        continue
      }

      try {
        await send(entry.payload)
        delete entries[sessionId]
        sent.push(sessionId)
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 401 || error.code === "unauthorized") {
            // The token is gone: pause until the caller signs in again.
            unauthorized = true
            break
          }

          if (error.retryable) {
            break
          }

          // A 422 or another 4xx cannot improve with time; drop it.
          delete entries[sessionId]
          dropped.push(sessionId)
          continue
        }

        // An unknown failure is treated as retryable rather than losing data.
        break
      }
    }

    this.write(entries)

    return {
      sent,
      dropped,
      remaining: Object.keys(entries),
      unauthorized,
    }
  }

  private read(): Record<string, StoredEntry> {
    let parsed: unknown

    try {
      const raw = this.storage.getItem(this.key)

      if (raw === null || raw.trim() === "") {
        return {}
      }

      parsed = JSON.parse(raw)
    } catch {
      return {}
    }

    if (!isRecord(parsed)) {
      return {}
    }

    const entries: Record<string, StoredEntry> = {}

    for (const [sessionId, value] of Object.entries(parsed)) {
      if (isStoredEntry(value)) {
        entries[sessionId] = value
      }
    }

    return entries
  }

  private write(entries: Record<string, StoredEntry>): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(entries))
    } catch {
      // A blocked storage area costs the retry, not the session that is
      // already on screen; the caller reports "waiting to save".
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStoredEntry(value: unknown): value is StoredEntry {
  return (
    isRecord(value) &&
    typeof value.queuedAt === "number" &&
    isRecord(value.payload) &&
    isRecord(value.payload.session) &&
    typeof value.payload.session.id === "string"
  )
}
