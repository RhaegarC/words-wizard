import type { ProgressProvider } from "@shared/provider"
import {
  MAX_IMPORT_COUNTER,
  MAX_IMPORT_TIMESTAMP,
  hasImportableData,
  mergeProgressRows,
  type LegacyImportMetricRow,
  type LegacyImportOutcome,
  type LegacyImportPayload,
  type LegacyImportProgressRow,
} from "@shared/legacyImport"
import { isLocalDate } from "@shared/localDate"
import type { ProgressStatus } from "@shared/types"

import {
  deleteLegacyDatabase,
  readLegacyLocalData,
  type LegacyDeleteResult,
  type LegacyReadResult,
  type LegacyRecord,
} from "./localData"

/**
 * Client orchestration for the Mission 1 import (feature 27).
 *
 * Reading, mapping, and deleting are separate steps so each one is testable
 * without a real IndexedDB. `autoImportLegacy` never throws: a boot that fails
 * to import must still boot.
 */

export interface LegacyPayloadBuild {
  readonly payload: LegacyImportPayload
  /** Rows for the chosen profile that could not be mapped and were skipped. */
  readonly dropped: number
}

export type LegacyImportStatus =
  | { readonly status: "none" }
  | { readonly status: "unreadable" }
  | { readonly status: "empty" }
  | { readonly status: "deferred" }
  | { readonly status: "failed" }
  | {
      readonly status: "imported"
      readonly summary: LegacyImportOutcome
      readonly deleted: LegacyDeleteResult
    }

export interface LegacyImportDeps {
  readonly read?: () => Promise<LegacyReadResult>
  readonly remove?: () => Promise<LegacyDeleteResult>
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function counter(value: unknown): number {
  return Math.min(
    MAX_IMPORT_COUNTER,
    Math.max(0, Math.trunc(numberOr(value, 0))),
  )
}

function timestamp(value: unknown): number {
  return Math.min(
    MAX_IMPORT_TIMESTAMP,
    Math.max(0, Math.trunc(numberOr(value, 0))),
  )
}

function optionalTimestamp(value: unknown): number | null {
  return value === null || value === undefined ? null : timestamp(value)
}

function statusOrNull(value: unknown): ProgressStatus | null {
  return value === "new" || value === "learning" || value === "mastered"
    ? value
    : null
}

function profileIdOf(record: LegacyRecord): number | null {
  const id = numberOr(record.id, Number.NaN)
  return Number.isFinite(id) ? id : null
}

/**
 * Mission 1 allowed several profiles on one device. The child's most recently
 * practised one is the account being upgraded; the tie-breaks are stable so
 * two runs on the same data pick the same profile.
 */
function selectProfile(profiles: readonly LegacyRecord[]): LegacyRecord | null {
  let chosen: LegacyRecord | null = null
  let chosenKey: [number, number, number] | null = null

  for (const profile of profiles) {
    const id = profileIdOf(profile)
    if (id === null) continue

    const key: [number, number, number] = [
      numberOr(profile.lastPracticeAt, 0),
      numberOr(profile.createdAt, 0),
      id,
    ]

    if (
      chosenKey === null ||
      key[0] > chosenKey[0] ||
      (key[0] === chosenKey[0] && key[1] > chosenKey[1]) ||
      (key[0] === chosenKey[0] &&
        key[1] === chosenKey[1] &&
        key[2] > chosenKey[2])
    ) {
      chosen = profile
      chosenKey = key
    }
  }

  return chosen
}

function toProgressRow(
  record: LegacyRecord,
): LegacyImportProgressRow | null {
  const wordId = record.wordId
  const status = statusOrNull(record.status)

  if (typeof wordId !== "string" || wordId.trim() === "" || status === null) {
    return null
  }

  return {
    wordId,
    status,
    // A Mission 1 row written before a field existed defaults rather than
    // rejecting the whole history.
    strength: Math.min(1, Math.max(0, numberOr(record.strength, 0))),
    nextReviewAt: timestamp(record.nextReviewAt),
    correctCount: counter(record.correctCount),
    wrongCount: counter(record.wrongCount),
    firstSeenAt: timestamp(record.firstSeenAt),
    lastSeenAt: timestamp(record.lastSeenAt),
    masteryXpAwarded: record.masteryXpAwarded === true,
  }
}

function toMetricRow(record: LegacyRecord): LegacyImportMetricRow | null {
  const name = record.name
  const value = record.value

  if (
    typeof name !== "string" ||
    name.trim() === "" ||
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null
  }

  return { name, value, updatedAt: timestamp(record.updatedAt) }
}

function dedupeProgress(
  rows: readonly LegacyImportProgressRow[],
): LegacyImportProgressRow[] {
  const byWord = new Map<string, LegacyImportProgressRow>()

  for (const row of rows) {
    const existing = byWord.get(row.wordId)
    byWord.set(
      row.wordId,
      existing === undefined ? row : mergeProgressRows(row, existing),
    )
  }

  return [...byWord.values()]
}

function dedupeMetrics(rows: readonly LegacyImportMetricRow[]): LegacyImportMetricRow[] {
  const byName = new Map<string, LegacyImportMetricRow>()

  for (const row of rows) {
    const existing = byName.get(row.name)
    byName.set(
      row.name,
      existing === undefined
        ? row
        : {
            name: row.name,
            value: Math.max(existing.value, row.value),
            updatedAt: Math.max(existing.updatedAt, row.updatedAt),
          },
    )
  }

  return [...byName.values()]
}

/**
 * Build the payload from the ready read, or `null` when there is no usable
 * profile or nothing worth importing. Rows are filtered by the chosen
 * profile's legacy numeric id; the server never sees that id.
 */
export function buildLegacyImportPayload(
  read: Extract<LegacyReadResult, { status: "ready" }>,
): LegacyPayloadBuild | null {
  const profile = selectProfile(read.profiles)
  if (profile === null) return null

  const profileId = profileIdOf(profile)
  const ownRows = (records: readonly LegacyRecord[]) =>
    records.filter((record) => numberOr(record.profileId, Number.NaN) === profileId)

  let dropped = 0
  const progress: LegacyImportProgressRow[] = []

  for (const record of ownRows(read.progress)) {
    const row = toProgressRow(record)
    if (row === null) dropped += 1
    else progress.push(row)
  }

  const metrics: LegacyImportMetricRow[] = []

  for (const record of ownRows(read.metrics)) {
    const row = toMetricRow(record)
    if (row === null) dropped += 1
    else metrics.push(row)
  }

  const payload: LegacyImportPayload = {
    profile: {
      xp: counter(profile.xp),
      lastPracticeAt: timestamp(profile.lastPracticeAt),
      lastWakeAt: optionalTimestamp(profile.lastWakeAt),
      frozenDays: counter(profile.frozenDays),
      careTokens: counter(profile.careTokens),
      sessionsSinceLastToken: counter(profile.sessionsSinceLastToken),
      completedSessions: counter(profile.completedSessions),
      streakCount: counter(profile.streakCount),
      bestStreak: counter(profile.bestStreak),
      lastStreakDate: isLocalDate(profile.lastStreakDate)
        ? profile.lastStreakDate
        : null,
      lastMonthlyReviewAt: optionalTimestamp(profile.lastMonthlyReviewAt),
    },
    progress: dedupeProgress(progress),
    metrics: dedupeMetrics(metrics),
  }

  return hasImportableData(payload) ? { payload, dropped } : null
}

/**
 * Run the import once. Order matters: the outbox has already drained, so the
 * merge compares against the newest cloud state; deletion happens only after
 * the server accepted the payload.
 */
export async function autoImportLegacy(
  provider: ProgressProvider,
  deps: LegacyImportDeps = {},
): Promise<LegacyImportStatus> {
  try {
    const read = await (deps.read ?? (() => readLegacyLocalData()))()

    if (read.status === "absent") return { status: "none" }
    if (read.status === "unreadable") return { status: "unreadable" }

    const build = buildLegacyImportPayload(read)
    if (build === null) return { status: "empty" }

    // A new identity has no profile at boot; the import runs right after
    // character creation instead.
    if ((await provider.getProfile()) === null) return { status: "deferred" }

    const summary = await provider.importLegacyProgress(build.payload)
    const deleted = await (deps.remove ?? (() => deleteLegacyDatabase()))()

    return { status: "imported", summary, deleted }
  } catch (error) {
    console.warn("[legacy-import] Could not import the Mission 1 data", error)
    return { status: "failed" }
  }
}
