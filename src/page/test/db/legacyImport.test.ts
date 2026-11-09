import { describe, expect, it, vi } from "vitest"

import type { LegacyImportOutcome } from "@shared/legacyImport"
import type { ProgressProvider } from "@shared/provider"
import type { Profile } from "@shared/types"

import {
  autoImportLegacy,
  buildLegacyImportPayload,
} from "../../db/legacyImport"
import type { LegacyReadResult } from "../../db/localData"

const NOW = 1_760_000_000_000

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "oid-1",
    name: "Mia",
    characterName: "Mia",
    avatar: "alex",
    currentTopicId: null,
    xp: 0,
    createdAt: NOW,
    lastPracticeAt: NOW,
    lastWakeAt: null,
    frozenDays: 0,
    careTokens: 0,
    sessionsSinceLastToken: 0,
    completedSessions: 0,
    streakCount: 0,
    bestStreak: 0,
    lastStreakDate: null,
    lastMonthlyReviewAt: null,
    locale: "en",
    role: "user",
    userAvatarKey: null,
    ...overrides,
  }
}

function applied(overrides: Partial<LegacyImportOutcome> = {}): LegacyImportOutcome {
  return {
    progress: { imported: 1, skipped: 0 },
    metrics: { imported: 1, skipped: 0 },
    profileUpdated: true,
    profile: profile(),
    ...overrides,
  }
}

function provider(
  overrides: Partial<ProgressProvider> = {},
): ProgressProvider {
  return {
    getProfile: async () => profile(),
    importLegacyProgress: async () => applied(),
    ...overrides,
  } as ProgressProvider
}

function ready(
  overrides: Partial<Extract<LegacyReadResult, { status: "ready" }>> = {},
): Extract<LegacyReadResult, { status: "ready" }> {
  return {
    status: "ready",
    profiles: [
      {
        id: 1,
        name: "Mia",
        characterName: "Mia",
        avatar: "alex",
        xp: 120,
        createdAt: NOW - 1000,
        lastPracticeAt: NOW,
        frozenDays: 1,
        careTokens: 1,
        sessionsSinceLastToken: 0,
        completedSessions: 4,
        streakCount: 2,
        bestStreak: 3,
        lastStreakDate: "2026-10-30",
        lastWakeAt: null,
        lastMonthlyReviewAt: null,
      },
    ],
    progress: [
      {
        profileId: 1,
        wordId: "w-1",
        status: "learning",
        strength: 0.4,
        nextReviewAt: NOW,
        correctCount: 1,
        wrongCount: 0,
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        masteryXpAwarded: false,
      },
    ],
    metrics: [
      { profileId: 1, name: "session.completed", value: 4, updatedAt: NOW },
    ],
    ...overrides,
  }
}

describe("buildLegacyImportPayload", () => {
  it("uses the most recently practised profile and only its rows", () => {
    const result = buildLegacyImportPayload(
      ready({
        profiles: [
          {
            id: 1,
            xp: 10,
            createdAt: NOW - 5000,
            lastPracticeAt: NOW - 1000,
          },
          {
            id: 2,
            xp: 200,
            createdAt: NOW - 9000,
            lastPracticeAt: NOW,
            completedSessions: 7,
          },
        ],
        progress: [
          {
            profileId: 1,
            wordId: "old-word",
            status: "mastered",
            strength: 0.9,
            nextReviewAt: 1,
            correctCount: 8,
            wrongCount: 0,
            firstSeenAt: 1,
            lastSeenAt: 1,
            masteryXpAwarded: true,
          },
          {
            profileId: 2,
            wordId: "w-1",
            status: "learning",
            strength: 0.4,
            nextReviewAt: NOW,
            correctCount: 1,
            wrongCount: 0,
            firstSeenAt: NOW,
            lastSeenAt: NOW,
            masteryXpAwarded: false,
          },
        ],
        metrics: [
          { profileId: 1, name: "session.completed", value: 99, updatedAt: 1 },
          { profileId: 2, name: "session.completed", value: 4, updatedAt: NOW },
        ],
      }),
    )

    expect(result).not.toBeNull()
    expect(result?.payload.profile.xp).toBe(200)
    expect(result?.payload.profile.completedSessions).toBe(7)
    expect(result?.payload.progress.map((row) => row.wordId)).toEqual(["w-1"])
    expect(result?.payload.metrics).toEqual([
      { name: "session.completed", value: 4, updatedAt: NOW },
    ])
  })

  it("dedupes a word by the most advanced row and ORs mastery", () => {
    const result = buildLegacyImportPayload(
      ready({
        progress: [
          {
            profileId: 1,
            wordId: "w-1",
            status: "learning",
            strength: 0.4,
            nextReviewAt: 10,
            correctCount: 1,
            wrongCount: 0,
            firstSeenAt: 1,
            lastSeenAt: 1,
            masteryXpAwarded: false,
          },
          {
            profileId: 1,
            wordId: "w-1",
            status: "mastered",
            strength: 0.9,
            nextReviewAt: 20,
            correctCount: 6,
            wrongCount: 1,
            firstSeenAt: 1,
            lastSeenAt: 2,
            masteryXpAwarded: true,
          },
        ],
      }),
    )

    expect(result?.payload.progress).toEqual([
      expect.objectContaining({
        wordId: "w-1",
        status: "mastered",
        strength: 0.9,
        masteryXpAwarded: true,
      }),
    ])
  })

  it("dedupes a metric by taking the max value and the latest update", () => {
    const result = buildLegacyImportPayload(
      ready({
        metrics: [
          { profileId: 1, name: "xp.earned", value: 10, updatedAt: 5 },
          { profileId: 1, name: "xp.earned", value: 3, updatedAt: 9 },
        ],
      }),
    )

    expect(result?.payload.metrics).toEqual([
      { name: "xp.earned", value: 10, updatedAt: 9 },
    ])
  })

  it("drops malformed rows and counts them", () => {
    const result = buildLegacyImportPayload(
      ready({
        progress: [
          { profileId: 1, wordId: "", status: "learning" },
          { profileId: 1, wordId: "w-2", status: "started" },
          {
            profileId: 1,
            wordId: "w-3",
            status: "learning",
            strength: 0.5,
            nextReviewAt: NOW,
            correctCount: 1,
            wrongCount: 0,
            firstSeenAt: NOW,
            lastSeenAt: NOW,
            masteryXpAwarded: false,
          },
        ],
        metrics: [
          { profileId: 1, name: "", value: 1, updatedAt: 1 },
          { profileId: 1, name: "word.learned", value: 2, updatedAt: 1 },
        ],
      }),
    )

    expect(result?.payload.progress.map((row) => row.wordId)).toEqual(["w-3"])
    expect(result?.payload.metrics.map((row) => row.name)).toEqual([
      "word.learned",
    ])
    expect(result?.dropped).toBe(3)
  })

  it("defaults a pre-feature row instead of rejecting it", () => {
    const result = buildLegacyImportPayload(
      ready({
        progress: [
          { profileId: 1, wordId: "w-1", status: "learning" },
        ],
        metrics: [{ profileId: 1, name: "word.learned", value: 2 }],
      }),
    )

    expect(result?.payload.progress[0]).toEqual({
      wordId: "w-1",
      status: "learning",
      strength: 0,
      nextReviewAt: 0,
      correctCount: 0,
      wrongCount: 0,
      firstSeenAt: 0,
      lastSeenAt: 0,
      masteryXpAwarded: false,
    })
    expect(result?.payload.metrics[0]).toEqual({
      name: "word.learned",
      value: 2,
      updatedAt: 0,
    })
  })

  it("returns null when there is no profile", () => {
    expect(buildLegacyImportPayload(ready({ profiles: [] }))).toBeNull()
  })

  it("returns null when the profile has nothing worth importing", () => {
    expect(
      buildLegacyImportPayload(
        ready({
          profiles: [{ id: 1, lastPracticeAt: NOW, createdAt: NOW }],
          progress: [],
          metrics: [],
        }),
      ),
    ).toBeNull()
  })
})

describe("autoImportLegacy", () => {
  it("does nothing when there is no legacy database", async () => {
    const importLegacyProgress = vi.fn()
    const getProfile = vi.fn()

    const outcome = await autoImportLegacy(provider({ importLegacyProgress, getProfile }), {
      read: async () => ({ status: "absent" }),
      remove: vi.fn(),
    })

    expect(outcome).toEqual({ status: "none" })
    expect(getProfile).not.toHaveBeenCalled()
    expect(importLegacyProgress).not.toHaveBeenCalled()
  })

  it("reports an unreadable database without touching the profile", async () => {
    const getProfile = vi.fn()

    const outcome = await autoImportLegacy(provider({ getProfile }), {
      read: async () => ({ status: "unreadable" }),
      remove: vi.fn(),
    })

    expect(outcome).toEqual({ status: "unreadable" })
    expect(getProfile).not.toHaveBeenCalled()
  })

  it("reports empty and keeps the database when there is nothing to import", async () => {
    const remove = vi.fn()

    const outcome = await autoImportLegacy(provider(), {
      read: async () => ready({ profiles: [], progress: [], metrics: [] }),
      remove,
    })

    expect(outcome).toEqual({ status: "empty" })
    expect(remove).not.toHaveBeenCalled()
  })

  it("defers when the identity has no cloud profile yet", async () => {
    const importLegacyProgress = vi.fn()

    const outcome = await autoImportLegacy(
      provider({ getProfile: async () => null, importLegacyProgress }),
      { read: async () => ready(), remove: vi.fn() },
    )

    expect(outcome).toEqual({ status: "deferred" })
    expect(importLegacyProgress).not.toHaveBeenCalled()
  })

  it("imports, then deletes the legacy database", async () => {
    const importLegacyProgress = vi.fn(async () => applied())
    const remove = vi.fn(async () => "deleted" as const)

    const outcome = await autoImportLegacy(
      provider({ importLegacyProgress }),
      { read: async () => ready(), remove },
    )

    expect(importLegacyProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({ xp: 120 }),
      }),
    )
    expect(remove).toHaveBeenCalledTimes(1)
    expect(outcome).toMatchObject({
      status: "imported",
      deleted: "deleted",
      summary: applied(),
    })
  })

  it("reports a blocked deletion but still says the import succeeded", async () => {
    const outcome = await autoImportLegacy(provider(), {
      read: async () => ready(),
      remove: async () => "blocked",
    })

    expect(outcome).toMatchObject({ status: "imported", deleted: "blocked" })
  })

  it("leaves the database in place when the import fails", async () => {
    const remove = vi.fn()

    const outcome = await autoImportLegacy(
      provider({
        importLegacyProgress: async () => {
          throw new Error("network")
        },
      }),
      { read: async () => ready(), remove },
    )

    expect(outcome).toEqual({ status: "failed" })
    expect(remove).not.toHaveBeenCalled()
  })

  it("never throws when the reader itself throws", async () => {
    const outcome = await autoImportLegacy(provider(), {
      read: async () => {
        throw new Error("IndexedDB denied")
      },
      remove: vi.fn(),
    })

    expect(outcome).toEqual({ status: "failed" })
  })

  it("never throws when the profile lookup fails", async () => {
    const outcome = await autoImportLegacy(
      provider({
        getProfile: async () => {
          throw new Error("offline")
        },
      }),
      { read: async () => ready(), remove: vi.fn() },
    )

    expect(outcome).toEqual({ status: "failed" })
  })
})
