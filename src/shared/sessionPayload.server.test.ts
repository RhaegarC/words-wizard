import { describe, expect, it } from "vitest"

import { METRIC_NAMES } from "./metrics"
import type {
  ServerProgressCommit,
  ServerSessionCommitPayload,
} from "./sessionPayload"
import { validateServerSessionPayload } from "./sessionPayload"

const NOW = 1_760_000_000_000
const HOUR = 3_600_000
const DAY = 24 * HOUR

function payload(): ServerSessionCommitPayload {
  return {
    session: {
      id: "session-1",
      kind: "daily",
      localDate: "2026-10-30",
      contentVersion: "0.3.0",
      xpEarned: 7,
      finishedAt: NOW,
    },
    now: NOW,
    profile: {
      xp: 107,
      lastPracticeAt: NOW,
      lastWakeAt: null,
      frozenDays: 0,
      careTokens: 0,
      sessionsSinceLastToken: 1,
      completedSessions: 5,
      streakCount: 1,
      bestStreak: 2,
      lastStreakDate: "2026-10-30",
      lastMonthlyReviewAt: null,
    },
    progress: [
      {
        wordId: "w1",
        status: "learning",
        strength: 0.4,
        nextReviewAt: NOW + DAY,
        correctCount: 1,
        wrongCount: 0,
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        masteryXpAwarded: false,
      },
    ],
    introductions: [{ packId: "p1", wordId: "w1", introducedAt: NOW }],
    metrics: { [METRIC_NAMES.sessionCompleted]: 1 },
  }
}

function issues(change: (value: ServerSessionCommitPayload) => void) {
  const value = payload()
  change(value)
  return validateServerSessionPayload(value, NOW)
}

function progressRow(): ServerProgressCommit {
  return { ...payload().progress[0]! }
}

describe("validateServerSessionPayload", () => {
  it("accepts a complete payload", () => {
    expect(validateServerSessionPayload(payload(), NOW)).toEqual([])
  })

  it("refuses a payload that is not an object", () => {
    for (const value of [null, "body", 42, []]) {
      expect(validateServerSessionPayload(value, NOW)).toContain(
        "invalid-payload",
      )
    }
  })
})

describe("session record", () => {
  it("requires a non-empty id of at most 64 characters", () => {
    expect(issues((p) => (p.session.id = ""))).toContain("session-id-invalid")
    expect(issues((p) => (p.session.id = " ".repeat(3)))).toContain(
      "session-id-invalid",
    )
    expect(issues((p) => (p.session.id = "a".repeat(64)))).not.toContain(
      "session-id-invalid",
    )
    expect(issues((p) => (p.session.id = "a".repeat(65)))).toContain(
      "session-id-invalid",
    )
  })

  it("accepts only the two session kinds", () => {
    expect(issues((p) => (p.session.kind = "weekly" as "daily"))).toContain(
      "session-kind-invalid",
    )
  })

  it("requires a real local date", () => {
    for (const date of ["2026-13-01", "2026-02-30", "30-10-2026", ""]) {
      expect(issues((p) => (p.session.localDate = date))).toContain(
        "session-date-invalid",
      )
    }

    expect(issues((p) => (p.session.localDate = "2024-02-29"))).toEqual([])
  })

  it("requires a content version", () => {
    expect(issues((p) => (p.session.contentVersion = "  "))).toContain(
      "session-version-invalid",
    )
  })

  it("bounds xpEarned to whole numbers in 0..10000", () => {
    for (const value of [-1, 1.5, 10_001]) {
      expect(issues((p) => (p.session.xpEarned = value))).toContain(
        "session-xp-invalid",
      )
    }

    expect(issues((p) => (p.session.xpEarned = 0))).toEqual([])
    expect(issues((p) => (p.session.xpEarned = 10_000))).toEqual([])
  })
})

describe("clock", () => {
  it("accepts now inside the 24-hour window and rejects one step past it", () => {
    expect(issues((p) => (p.now = NOW + DAY))).toEqual([])
    expect(issues((p) => (p.now = NOW - DAY))).toEqual([])
    expect(issues((p) => (p.now = NOW + DAY + 1))).toContain(
      "clock-out-of-range",
    )
    expect(issues((p) => (p.now = NOW - DAY - 1))).toContain(
      "clock-out-of-range",
    )
  })

  it("applies the same window to finishedAt and practice timestamps", () => {
    expect(issues((p) => (p.session.finishedAt = NOW + DAY + 1))).toContain(
      "clock-out-of-range",
    )
    expect(issues((p) => (p.profile.lastPracticeAt = NOW - DAY - 1))).toContain(
      "clock-out-of-range",
    )
    expect(issues((p) => (p.profile.lastWakeAt = NOW + DAY + 1))).toContain(
      "clock-out-of-range",
    )
    expect(
      issues((p) => (p.profile.lastMonthlyReviewAt = NOW - DAY - 1)),
    ).toContain("clock-out-of-range")
  })

  it("accepts a non-finite clock only as a rejection", () => {
    expect(issues((p) => (p.now = Number.NaN))).toContain("clock-out-of-range")
    expect(issues((p) => (p.now = Number.POSITIVE_INFINITY))).toContain(
      "clock-out-of-range",
    )
  })
})

describe("profile commit", () => {
  it("rejects a negative or non-finite value", () => {
    for (const key of [
      "xp",
      "frozenDays",
      "careTokens",
      "sessionsSinceLastToken",
      "completedSessions",
      "streakCount",
      "bestStreak",
    ] as const) {
      expect(issues((p) => (p.profile[key] = -1))).toContain(
        "profile-value-invalid",
      )
      expect(issues((p) => (p.profile[key] = Number.NaN))).toContain(
        "profile-value-invalid",
      )
    }
  })

  it("accepts null wake and review timestamps", () => {
    expect(
      issues((p) => {
        p.profile.lastWakeAt = null
        p.profile.lastMonthlyReviewAt = null
        p.profile.lastStreakDate = null
      }),
    ).toEqual([])
  })

  it("rejects an impossible streak date", () => {
    expect(issues((p) => (p.profile.lastStreakDate = "2026-02-30"))).toContain(
      "profile-value-invalid",
    )
  })
})

describe("progress", () => {
  it("accepts 40 rows and rejects 41", () => {
    const rows = Array.from({ length: 40 }, (_, index) => ({
      ...progressRow(),
      wordId: `w-${index}`,
    }))

    expect(issues((p) => (p.progress = rows))).toEqual([])
    expect(
      issues((p) => (p.progress = [...rows, { ...progressRow(), wordId: "w-40" }])),
    ).toContain("progress-too-many")
  })

  it("rejects a duplicate and an empty word id", () => {
    expect(
      issues((p) => (p.progress = [progressRow(), progressRow()])),
    ).toContain("progress-duplicate-word")
    expect(issues((p) => (p.progress[0]!.wordId = "  "))).toContain(
      "progress-word-missing",
    )
  })

  it("accepts only the three statuses", () => {
    expect(issues((p) => (p.progress[0]!.status = "started" as "new"))).toContain(
      "progress-value-invalid",
    )
  })

  it("bounds strength to 0..1", () => {
    for (const value of [-0.1, 1.1, Number.NaN]) {
      expect(issues((p) => (p.progress[0]!.strength = value))).toContain(
        "strength-out-of-range",
      )
    }

    expect(issues((p) => (p.progress[0]!.strength = 0))).toEqual([])
    expect(issues((p) => (p.progress[0]!.strength = 1))).toEqual([])
  })

  it("requires non-negative integer counts and a boolean mastery flag", () => {
    for (const key of [
      "correctCount",
      "wrongCount",
      "firstSeenAt",
      "lastSeenAt",
      "nextReviewAt",
    ] as const) {
      expect(issues((p) => (p.progress[0]![key] = -1))).toContain(
        "progress-value-invalid",
      )
    }

    expect(issues((p) => (p.progress[0]!.correctCount = 1.5))).toContain(
      "progress-value-invalid",
    )
    expect(
      issues((p) => (p.progress[0]!.masteryXpAwarded = "yes" as unknown as boolean)),
    ).toContain("progress-value-invalid")
  })

  it("rejects a next review before the commit time", () => {
    expect(issues((p) => (p.progress[0]!.nextReviewAt = NOW - 1))).toContain(
      "review-in-past",
    )
    expect(issues((p) => (p.progress[0]!.nextReviewAt = NOW))).toEqual([])
  })
})

describe("introductions", () => {
  it("accepts 40 rows and rejects 41", () => {
    const rows = Array.from({ length: 40 }, (_, index) => ({
      packId: "p1",
      wordId: `w-${index}`,
      introducedAt: NOW,
    }))

    expect(issues((p) => (p.introductions = rows))).toEqual([])
    expect(
      issues((p) => (p.introductions = [...rows, { packId: "p1", wordId: "w-40", introducedAt: NOW }])),
    ).toContain("introduction-too-many")
  })

  it("rejects a duplicate pair, whichever pack it names", () => {
    const row = { packId: "p1", wordId: "w1", introducedAt: NOW }

    expect(issues((p) => (p.introductions = [row, { ...row }]))).toContain(
      "introduction-duplicate",
    )
  })

  it("rejects empty ids and an out-of-window timestamp", () => {
    expect(issues((p) => (p.introductions[0]!.packId = " "))).toContain(
      "introduction-pair-invalid",
    )
    expect(issues((p) => (p.introductions[0]!.wordId = ""))).toContain(
      "introduction-pair-invalid",
    )
    expect(
      issues((p) => (p.introductions[0]!.introducedAt = NOW + DAY + 1)),
    ).toContain("clock-out-of-range")
  })
})

describe("metrics", () => {
  it("accepts a known metric name and no metrics at all", () => {
    expect(
      issues((p) => (p.metrics = { [METRIC_NAMES.wordLearned]: 2 })),
    ).toEqual([])
    expect(issues((p) => (p.metrics = {}))).toEqual([])
    expect(issues((p) => (p.metrics = undefined))).toEqual([])
  })

  it("rejects an unknown name and a non-finite delta", () => {
    expect(issues((p) => (p.metrics = { "made.up": 1 } as never))).toContain(
      "metric-name-invalid",
    )
    expect(
      issues((p) => (p.metrics = { [METRIC_NAMES.wordLearned]: Number.NaN })),
    ).toContain("metric-delta-invalid")
  })

  it("allows only the signed review metric to be negative", () => {
    expect(
      issues((p) => (p.metrics = { [METRIC_NAMES.wordLearned]: -1 })),
    ).toContain("metric-delta-invalid")
    expect(
      issues((p) => (p.metrics = { [METRIC_NAMES.reviewStrengthDelta]: -0.5 })),
    ).toEqual([])
    expect(
      issues((p) => (p.metrics = { [METRIC_NAMES.reviewStrengthDelta]: -1.1 })),
    ).toContain("metric-delta-invalid")
    expect(
      issues((p) => (p.metrics = { [METRIC_NAMES.reviewStrengthDelta]: 1.1 })),
    ).toContain("metric-delta-invalid")
  })
})

describe("rejection reporting", () => {
  it("reports every issue rather than stopping at the first", () => {
    expect(
      issues((p) => {
        p.session.id = ""
        p.progress[0]!.strength = 2
        p.now = NOW + 2 * DAY
      }).sort(),
    ).toEqual(
      [
        "clock-out-of-range",
        "review-in-past",
        "session-id-invalid",
        "strength-out-of-range",
      ].sort(),
    )
  })
})
