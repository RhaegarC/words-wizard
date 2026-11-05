import { describe, expect, it } from "vitest"

import {
  MAX_IMPORT_COUNTER,
  MAX_IMPORT_METRIC_ROWS,
  MAX_IMPORT_PROGRESS_ROWS,
  MAX_IMPORT_TIMESTAMP,
  hasImportableData,
  incomingProgressWins,
  laterLocalDate,
  laterTimestamp,
  mergeCounter,
  mergeProgressRows,
  parseLegacyImport,
  progressRank,
  type LegacyImportPayload,
} from "../legacyImport"

function payload(overrides: Partial<LegacyImportPayload> = {}): LegacyImportPayload {
  return {
    profile: {
      xp: 120,
      lastPracticeAt: 1_700_000_000_000,
      lastWakeAt: null,
      frozenDays: 1,
      careTokens: 2,
      sessionsSinceLastToken: 3,
      completedSessions: 9,
      streakCount: 4,
      bestStreak: 7,
      lastStreakDate: "2026-10-30",
      lastMonthlyReviewAt: null,
    },
    progress: [
      {
        wordId: "w-1",
        status: "learning",
        strength: 0.4,
        nextReviewAt: 1_700_000_000_000,
        correctCount: 2,
        wrongCount: 1,
        firstSeenAt: 1_600_000_000_000,
        lastSeenAt: 1_700_000_000_000,
        masteryXpAwarded: false,
      },
    ],
    metrics: [
      { name: "session.completed", value: 9, updatedAt: 1_700_000_000_000 },
    ],
    ...overrides,
  }
}

function withProfile(
  overrides: Partial<LegacyImportPayload["profile"]>,
): LegacyImportPayload {
  return payload({ profile: { ...payload().profile, ...overrides } })
}

function progress(
  overrides: Partial<LegacyImportPayload["progress"][number]> = {},
): LegacyImportPayload["progress"][number] {
  return { ...payload().progress[0]!, ...overrides }
}

describe("parseLegacyImport", () => {
  it("accepts a well-formed payload and returns exactly the three collections", () => {
    const parsed = parseLegacyImport(payload())

    expect(parsed).toEqual({ ok: true, value: payload() })
  })

  it("accepts an empty progress and metrics list", () => {
    const parsed = parseLegacyImport(payload({ progress: [], metrics: [] }))

    expect(parsed.ok).toBe(true)
  })

  it("rejects an unknown top-level field", () => {
    const parsed = parseLegacyImport({ ...payload(), oid: "victim" })

    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues).toContain("unknown-field")
  })

  it("rejects identity and display fields inside the profile", () => {
    for (const field of [
      "id",
      "profileId",
      "name",
      "characterName",
      "avatar",
      "currentTopicId",
      "locale",
      "createdAt",
      "role",
      "userAvatarKey",
    ]) {
      const parsed = parseLegacyImport(withProfile({ [field]: "x" } as never))

      expect(parsed.ok, field).toBe(false)
      if (!parsed.ok) expect(parsed.issues, field).toContain("unknown-field")
    }
  })

  it("rejects a missing or non-object section", () => {
    for (const body of [null, [], {}, { profile: {} }, { profile: {}, progress: [], metrics: [] }]) {
      expect(parseLegacyImport(body).ok).toBe(false)
    }
  })

  it("rejects more progress rows or metric rows than the caps", () => {
    const manyProgress = Array.from(
      { length: MAX_IMPORT_PROGRESS_ROWS + 1 },
      (_unused, index) => progress({ wordId: `w-${index}` }),
    )
    const manyMetrics = Array.from(
      { length: MAX_IMPORT_METRIC_ROWS + 1 },
      (_unused, index) => ({
        name: `metric.${index}`,
        value: 1,
        updatedAt: 0,
      }),
    )

    const progressResult = parseLegacyImport(payload({ progress: manyProgress }))
    const metricResult = parseLegacyImport(payload({ metrics: manyMetrics }))

    expect(progressResult.ok).toBe(false)
    expect(metricResult.ok).toBe(false)
  })

  it("rejects duplicate word ids and duplicate metric names", () => {
    const duplicateWords = parseLegacyImport(
      payload({ progress: [progress({ wordId: "w-1" }), progress({ wordId: "w-1" })] }),
    )
    const duplicateMetrics = parseLegacyImport(
      payload({
        metrics: [
          { name: "session.completed", value: 1, updatedAt: 0 },
          { name: "session.completed", value: 2, updatedAt: 0 },
        ],
      }),
    )

    expect(duplicateWords.ok).toBe(false)
    if (!duplicateWords.ok) {
      expect(duplicateWords.issues).toContain("duplicate-word-id")
    }
    expect(duplicateMetrics.ok).toBe(false)
    if (!duplicateMetrics.ok) {
      expect(duplicateMetrics.issues).toContain("duplicate-metric-name")
    }
  })

  it("rejects a strength outside zero to one", () => {
    for (const strength of [-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        parseLegacyImport(payload({ progress: [progress({ strength })] })).ok,
      ).toBe(false)
    }
  })

  it("rejects a status outside the three values and a non-boolean mastery", () => {
    expect(
      parseLegacyImport(
        payload({ progress: [progress({ status: "started" as never })] }),
      ).ok,
    ).toBe(false)
    expect(
      parseLegacyImport(
        payload({ progress: [progress({ masteryXpAwarded: 1 as never })] }),
      ).ok,
    ).toBe(false)
  })

  it("rejects counters outside integer zero to the cap", () => {
    for (const xp of [-1, 1.5, MAX_IMPORT_COUNTER + 1, Number.NaN]) {
      expect(parseLegacyImport(withProfile({ xp })).ok, String(xp)).toBe(false)
    }
  })

  it("rejects timestamps outside zero to the year-2100 cap", () => {
    for (const lastPracticeAt of [-1, 1.5, MAX_IMPORT_TIMESTAMP + 1]) {
      expect(
        parseLegacyImport(withProfile({ lastPracticeAt })).ok,
        String(lastPracticeAt),
      ).toBe(false)
    }
  })

  it("accepts a null wake and review timestamp but rejects a malformed date", () => {
    expect(
      parseLegacyImport(
        withProfile({ lastWakeAt: null, lastMonthlyReviewAt: null }),
      ).ok,
    ).toBe(true)

    for (const lastStreakDate of ["2026-13-40", "30-10-2026", "2026-1-1"]) {
      expect(
        parseLegacyImport(withProfile({ lastStreakDate })).ok,
        lastStreakDate,
      ).toBe(false)
    }
  })

  it("accepts signed metric values but rejects a non-finite one", () => {
    expect(
      parseLegacyImport(
        payload({
          metrics: [
            { name: "monthlyReview.strengthDelta", value: -0.4, updatedAt: 0 },
          ],
        }),
      ).ok,
    ).toBe(true)
    expect(
      parseLegacyImport(
        payload({ metrics: [{ name: "x", value: Number.NaN, updatedAt: 0 }] }),
      ).ok,
    ).toBe(false)
  })

  it("does not treat an unknown word id or metric name as a validation error", () => {
    const parsed = parseLegacyImport(
      payload({
        progress: [progress({ wordId: "retired-word" })],
        metrics: [{ name: "retired.metric", value: 1, updatedAt: 0 }],
      }),
    )

    expect(parsed.ok).toBe(true)
  })
})

describe("progress merge", () => {
  it("ranks new below learning below mastered", () => {
    expect(progressRank("new")).toBeLessThan(progressRank("learning"))
    expect(progressRank("learning")).toBeLessThan(progressRank("mastered"))
  })

  it("takes the higher rank first", () => {
    expect(
      incomingProgressWins(
        progress({ status: "mastered", strength: 0.1 }),
        progress({ status: "learning", strength: 1 }),
      ),
    ).toBe(true)
    expect(
      incomingProgressWins(
        progress({ status: "new", strength: 1 }),
        progress({ status: "learning", strength: 0 }),
      ),
    ).toBe(false)
  })

  it("breaks a rank tie on strength", () => {
    expect(
      incomingProgressWins(
        progress({ status: "learning", strength: 0.7 }),
        progress({ status: "learning", strength: 0.6 }),
      ),
    ).toBe(true)
  })

  it("breaks a rank and strength tie on the earlier review", () => {
    expect(
      incomingProgressWins(
        progress({ status: "learning", strength: 0.5, nextReviewAt: 10 }),
        progress({ status: "learning", strength: 0.5, nextReviewAt: 20 }),
      ),
    ).toBe(true)
    expect(
      incomingProgressWins(
        progress({ status: "learning", strength: 0.5, nextReviewAt: 20 }),
        progress({ status: "learning", strength: 0.5, nextReviewAt: 10 }),
      ),
    ).toBe(false)
  })

  it("keeps the cloud row on a full tie", () => {
    const row = progress()

    expect(incomingProgressWins(row, { ...row })).toBe(false)
  })

  it("writes the winning row whole", () => {
    const incoming = progress({
      status: "mastered",
      strength: 0.9,
      correctCount: 9,
      wrongCount: 2,
      lastSeenAt: 99,
    })
    const cloud = progress({ status: "learning", strength: 0.4 })

    expect(mergeProgressRows(incoming, cloud)).toEqual({
      ...incoming,
      masteryXpAwarded: false,
    })
    expect(mergeProgressRows(cloud, incoming)).toEqual({
      ...incoming,
      masteryXpAwarded: false,
    })
  })

  it("ORs mastery in either direction", () => {
    const awarded = mergeProgressRows(
      progress({ masteryXpAwarded: true }),
      progress({ masteryXpAwarded: false }),
    )
    const cloudAwarded = mergeProgressRows(
      progress({ masteryXpAwarded: false }),
      progress({ masteryXpAwarded: true }),
    )

    expect(awarded.masteryXpAwarded).toBe(true)
    expect(cloudAwarded.masteryXpAwarded).toBe(true)
  })
})

describe("counter merge", () => {
  it("takes the larger counter", () => {
    expect(mergeCounter(10, 5)).toBe(10)
    expect(mergeCounter(5, 10)).toBe(10)
  })

  it("takes the later timestamp and keeps the cloud when the incoming is null", () => {
    expect(laterTimestamp(10, 20)).toBe(20)
    expect(laterTimestamp(20, 10)).toBe(20)
    expect(laterTimestamp(20, null)).toBe(20)
    expect(laterTimestamp(null, 10)).toBe(10)
  })

  it("takes the lexicographically later local date and keeps the cloud on null", () => {
    expect(laterLocalDate("2026-10-01", "2026-10-30")).toBe("2026-10-30")
    expect(laterLocalDate("2026-10-30", "2026-10-01")).toBe("2026-10-30")
    expect(laterLocalDate("2026-10-30", null)).toBe("2026-10-30")
    expect(laterLocalDate(null, "2026-10-01")).toBe("2026-10-01")
  })
})

describe("hasImportableData", () => {
  it("is true when there is progress or a metric", () => {
    expect(hasImportableData(payload())).toBe(true)
    expect(
      hasImportableData(
        payload({
          profile: withProfile({ xp: 0 }).profile,
          progress: [],
          metrics: [{ name: "x", value: 1, updatedAt: 0 }],
        }),
      ),
    ).toBe(true)
  })

  it("is true when a counter is non-zero even with no rows", () => {
    expect(
      hasImportableData(
        payload({
          profile: withProfile({ xp: 5 }).profile,
          progress: [],
          metrics: [],
        }),
      ),
    ).toBe(true)
  })

  it("is false for a brand-new legacy profile", () => {
    expect(
      hasImportableData(
        payload({
          profile: {
            ...withProfile({ xp: 0, frozenDays: 0, careTokens: 0 }).profile,
            sessionsSinceLastToken: 0,
            completedSessions: 0,
            streakCount: 0,
            bestStreak: 0,
            lastStreakDate: null,
          },
          progress: [],
          metrics: [],
        }),
      ),
    ).toBe(false)
  })
})
