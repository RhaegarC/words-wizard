import { describe, expect, it, vi } from "vitest"

import { METRIC_NAMES } from "@shared/metrics"
import type { SessionCommitPayload } from "@shared/provider"

import { ApiError } from "./client"
import { OUTBOX_KEY, Outbox, type StorageLike } from "./outbox"

const NOW = 1_760_000_000_000

function memoryStorage(): StorageLike & { raw: Map<string, string> } {
  const raw = new Map<string, string>()

  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => {
      raw.set(key, value)
    },
    removeItem: (key) => {
      raw.delete(key)
    },
  }
}

function payload(sessionId: string): SessionCommitPayload {
  return {
    profileId: "oid-1",
    now: NOW,
    session: {
      id: sessionId,
      kind: "daily",
      localDate: "2026-10-30",
      contentVersion: "test",
      finishedAt: NOW,
    },
    xpEarned: 12,
    profile: {
      xp: 112,
      completedSessions: 4,
      lastPracticeAt: NOW,
    },
    progress: [
      {
        wordId: "w-bag",
        status: "learning",
        strength: 0.4,
        nextReviewAt: NOW + 86_400_000,
        correctCount: 1,
        wrongCount: 0,
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        masteryXpAwarded: false,
      },
    ],
    introductions: [{ packId: "p-1", wordId: "w-bag" }],
    metrics: { [METRIC_NAMES.sessionCompleted]: 1 },
  }
}

describe("Outbox", () => {
  it("keys a pending commit by its session id", () => {
    const storage = memoryStorage()
    const outbox = new Outbox(storage)

    outbox.enqueue(payload("session-1"), NOW)

    expect(outbox.all()).toEqual([
      { payload: payload("session-1"), queuedAt: NOW },
    ])
    expect(JSON.parse(storage.raw.get(OUTBOX_KEY) ?? "{}")).toHaveProperty(
      "session-1",
    )
  })

  it("replaces an entry re-enqueued under the same session id", () => {
    const outbox = new Outbox(memoryStorage())

    outbox.enqueue(payload("session-1"), NOW)
    outbox.enqueue(payload("session-1"), NOW + 1)

    expect(outbox.all()).toHaveLength(1)
    expect(outbox.all()[0]?.queuedAt).toBe(NOW + 1)
  })

  it("drains in queue order and removes every success", async () => {
    const outbox = new Outbox(memoryStorage())
    const sent: string[] = []

    outbox.enqueue(payload("late"), NOW + 10)
    outbox.enqueue(payload("early"), NOW)

    const report = await outbox.drain(async (pending) => {
      sent.push(pending.session.id)
    })

    expect(sent).toEqual(["early", "late"])
    expect(report).toEqual({
      sent: ["early", "late"],
      dropped: [],
      remaining: [],
      unauthorized: false,
    })
    expect(outbox.all()).toEqual([])
  })

  it("keeps the entry and stops on a retryable failure", async () => {
    const outbox = new Outbox(memoryStorage())
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("network", 0))
      .mockResolvedValue(undefined)

    outbox.enqueue(payload("session-1"), NOW)
    outbox.enqueue(payload("session-2"), NOW + 1)

    const first = await outbox.drain(send)

    expect(first.sent).toEqual([])
    expect(first.remaining).toEqual(["session-1", "session-2"])
    expect(outbox.all()).toHaveLength(2)
    expect(send).toHaveBeenCalledTimes(1)

    const second = await outbox.drain(send)

    expect(second.sent).toEqual(["session-1", "session-2"])
    expect(outbox.all()).toEqual([])
  })

  it("pauses without dropping on a 401", async () => {
    const outbox = new Outbox(memoryStorage())
    const send = vi.fn().mockRejectedValue(new ApiError("unauthorized", 401))

    outbox.enqueue(payload("session-1"), NOW)

    const report = await outbox.drain(send)

    expect(report.unauthorized).toBe(true)
    expect(report.dropped).toEqual([])
    expect(outbox.all()).toHaveLength(1)
  })

  it("drops a payload that no longer validates without sending it", async () => {
    const storage = memoryStorage()
    const outbox = new Outbox(storage)
    const invalid = payload("session-1")
    invalid.profileId = ""

    outbox.enqueue(invalid, NOW)

    const send = vi.fn().mockResolvedValue(undefined)
    const report = await outbox.drain(send)

    expect(send).not.toHaveBeenCalled()
    expect(report.dropped).toEqual(["session-1"])
    expect(outbox.all()).toEqual([])
  })

  it("drops a payload the server refuses, and keeps draining", async () => {
    const outbox = new Outbox(memoryStorage())
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("validation_failed", 422))
      .mockResolvedValueOnce(undefined)

    outbox.enqueue(payload("session-1"), NOW)
    outbox.enqueue(payload("session-2"), NOW + 1)

    const report = await outbox.drain(send)

    expect(report.dropped).toEqual(["session-1"])
    expect(report.sent).toEqual(["session-2"])
    expect(outbox.all()).toEqual([])
  })

  it("clears every pending commit", () => {
    const storage = memoryStorage()
    const outbox = new Outbox(storage)

    outbox.enqueue(payload("session-1"), NOW)
    outbox.clear()

    expect(outbox.all()).toEqual([])
    expect(storage.raw.get(OUTBOX_KEY)).toBe("{}")
  })

  it("treats a corrupt or foreign stored value as empty", () => {
    const storage = memoryStorage()

    for (const value of ["not json", "[]", '{"session-1":null}', "42"]) {
      storage.setItem(OUTBOX_KEY, value)

      expect(new Outbox(storage).all()).toEqual([])
    }
  })
})
