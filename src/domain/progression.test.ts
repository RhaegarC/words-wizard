import { describe, expect, it } from "vitest"

import { config } from "../config"
import { METRIC_NAMES } from "../db/metrics"
import { validateSessionPayload } from "../db/payload"
import {
  applyAttempt,
  applyCareTokenGrant,
  awardXp,
  buildSessionCommit,
  calcStreak,
  deriveStage,
  intervalDays,
  nextReviewAt,
  resolveStatus,
  stageProgress,
} from "./progression"
import {
  localDateKey,
  type SessionSeed,
} from "./session"
import type {
  Profile,
  Progress,
  SessionAttempt,
  SessionKind,
  SessionResult,
  SessionWordResult,
} from "./types"

const NOW = new Date(2026, 9, 21, 12, 0, 0).getTime()
const DAY = 86_400_000

const SEED: SessionSeed = {
  profileId: 1,
  localDate: "2026-10-21",
  kind: "daily",
  contentVersion: "dev",
}

function dayKey(offset: number): string {
  const date = new Date(2026, 9, 21)

  date.setDate(date.getDate() + offset)

  return localDateKey(date.getTime())
}

const TODAY = dayKey(0)
const YESTERDAY = dayKey(-1)

function makeProfile(
  overrides: Partial<Profile> = {},
): Profile & { id: number } {
  return {
    id: 1,
    name: "Mia",
    characterName: "Luma",
    avatar: "luma",
    currentTopicId: "craft-and-build",
    xp: 45,
    createdAt: NOW - 60 * DAY,
    lastPracticeAt: NOW - DAY,
    lastWakeAt: null,
    frozenDays: 2,
    careTokens: 0,
    sessionsSinceLastToken: 4,
    completedSessions: 7,
    streakCount: 2,
    bestStreak: 5,
    lastStreakDate: YESTERDAY,
    lastMonthlyReviewAt: null,
    locale: "en",
    ...overrides,
  }
}

function makeProgress(overrides: Partial<Progress> = {}): Progress {
  return {
    id: 10,
    profileId: 1,
    wordId: "w-bag",
    status: "learning",
    strength: 0,
    nextReviewAt: NOW,
    correctCount: 0,
    wrongCount: 0,
    firstSeenAt: NOW - 10 * DAY,
    lastSeenAt: NOW - DAY,
    masteryXpAwarded: false,
    ...overrides,
  }
}

function makeAttempt(overrides: Partial<SessionAttempt> = {}): SessionAttempt {
  return {
    wordId: "w-bag",
    mode: "pictureMatch",
    correct: true,
    hintLevel: 0,
    revealed: false,
    wrongTaps: 0,
    xp: 2,
    ...overrides,
  }
}

function makeWord(
  wordId: string,
  attempts: SessionAttempt[],
): SessionWordResult {
  return {
    wordId,
    firstAttemptCorrect:
      attempts[0]?.correct === true && attempts[0]?.wrongTaps === 0,
    attempts,
  }
}

function makeResult(
  words: SessionWordResult[],
  xpEarned: number,
  kind: SessionKind = "daily",
): SessionResult {
  return {
    id: `${SEED.profileId}:${kind}:${TODAY}:${NOW}`,
    kind,
    startedAt: NOW - 60_000,
    completedAt: NOW,
    words,
    xpEarned,
  }
}

describe("applyAttempt", () => {
  it("raises strength by 0.2 per correct answer", () => {
    expect(applyAttempt(makeProgress({ strength: 0 }), true).strength).toBe(0.2)
    expect(applyAttempt(makeProgress({ strength: 0.2 }), true).strength).toBe(
      0.4,
    )
  })

  it("caps strength at 1.0", () => {
    expect(applyAttempt(makeProgress({ strength: 0.9 }), true).strength).toBe(1)
    expect(applyAttempt(makeProgress({ strength: 1 }), true).strength).toBe(1)
  })

  it("lowers strength by 0.3 per wrong tap and floors it at 0", () => {
    expect(applyAttempt(makeProgress({ strength: 0.5 }), false).strength).toBe(
      0.2,
    )
    expect(applyAttempt(makeProgress({ strength: 0.2 }), false).strength).toBe(0)
    expect(applyAttempt(makeProgress({ strength: 0 }), false).strength).toBe(0)
  })

  it("nets -0.1 for a wrong tap followed by a correct answer", () => {
    const wrong = applyAttempt(makeProgress({ strength: 0.3 }), false)
    const thenCorrect = applyAttempt(wrong, true)

    expect(thenCorrect.strength).toBe(0.2)
  })

  it("counts a correct answer and every wrong tap", () => {
    const correct = applyAttempt(
      makeProgress({ correctCount: 2, wrongCount: 1 }),
      true,
    )

    expect(correct.correctCount).toBe(3)
    expect(correct.wrongCount).toBe(1)

    const wrong = applyAttempt(
      makeProgress({ correctCount: 2, wrongCount: 1 }),
      false,
    )

    expect(wrong.correctCount).toBe(2)
    expect(wrong.wrongCount).toBe(2)
  })

  it("returns a new row without mutating the input", () => {
    const before = makeProgress({ strength: 0.4, correctCount: 1 })
    const after = applyAttempt(before, true)

    expect(before.strength).toBe(0.4)
    expect(before.correctCount).toBe(1)
    expect(after).not.toBe(before)
  })
})

describe("intervalDays", () => {
  it("maps each strength band to its documented interval", () => {
    expect(intervalDays(0)).toBe(1)
    expect(intervalDays(0.19)).toBe(1)
    expect(intervalDays(0.2)).toBe(2)
    expect(intervalDays(0.39)).toBe(2)
    expect(intervalDays(0.4)).toBe(4)
    expect(intervalDays(0.59)).toBe(4)
    expect(intervalDays(0.6)).toBe(7)
    expect(intervalDays(0.79)).toBe(7)
    expect(intervalDays(0.8)).toBe(14)
    expect(intervalDays(0.99)).toBe(14)
    expect(intervalDays(1)).toBe(30)
  })

  it("clamps a strength outside 0–1 to the end bands", () => {
    expect(intervalDays(-1)).toBe(1)
    expect(intervalDays(2)).toBe(30)
  })

  it("uses the configured interval list", () => {
    expect(config.scheduler.intervals).toEqual([1, 2, 4, 7, 14, 30])
  })
})

describe("nextReviewAt", () => {
  it("adds the interval's days to the commit time", () => {
    expect(nextReviewAt(0.2, NOW)).toBe(NOW + 2 * DAY)
    expect(nextReviewAt(1, NOW)).toBe(NOW + 30 * DAY)
  })
})

describe("resolveStatus", () => {
  it("becomes mastered at strength 0.8 with three correct answers", () => {
    expect(
      resolveStatus({
        status: "learning",
        strength: 0.8,
        correctCount: 3,
      }),
    ).toBe("mastered")
  })

  it("does not master below the correct-answer threshold", () => {
    expect(
      resolveStatus({
        status: "learning",
        strength: 0.8,
        correctCount: 2,
      }),
    ).toBe("learning")
    expect(
      resolveStatus({
        status: "learning",
        strength: 1,
        correctCount: 2,
      }),
    ).toBe("learning")
  })

  it("does not master below the strength threshold", () => {
    expect(
      resolveStatus({
        status: "learning",
        strength: 0.79,
        correctCount: 10,
      }),
    ).toBe("learning")
  })

  it("keeps a mastered word mastered until strength falls below 0.5", () => {
    expect(
      resolveStatus({
        status: "mastered",
        strength: 0.79,
        correctCount: 10,
      }),
    ).toBe("mastered")
    expect(
      resolveStatus({
        status: "mastered",
        strength: 0.5,
        correctCount: 10,
      }),
    ).toBe("mastered")
  })

  it("demotes a mastered word whose strength falls below 0.5", () => {
    expect(
      resolveStatus({
        status: "mastered",
        strength: 0.49,
        correctCount: 10,
      }),
    ).toBe("learning")
  })
})

describe("awardXp", () => {
  it("pays answer XP plus the session-completion bonus", () => {
    expect(awardXp(makeResult([], 2))).toEqual({
      answer: 2,
      completion: 5,
      mastery: 0,
      total: 7,
    })
  })

  it("pays mastery XP only for newly mastered words", () => {
    expect(awardXp(makeResult([], 0), 1)).toEqual({
      answer: 0,
      completion: 5,
      mastery: 10,
      total: 15,
    })
    expect(awardXp(makeResult([], 0), 0).mastery).toBe(0)
  })
})

describe("deriveStage", () => {
  it("maps each threshold to its stage", () => {
    expect(deriveStage(0)).toBe("egg")
    expect(deriveStage(49)).toBe("egg")
    expect(deriveStage(50)).toBe("hatchling")
    expect(deriveStage(299)).toBe("hatchling")
    expect(deriveStage(300)).toBe("juvenile")
    expect(deriveStage(899)).toBe("juvenile")
    expect(deriveStage(900)).toBe("adult")
    expect(deriveStage(1999)).toBe("adult")
    expect(deriveStage(2000)).toBe("legendary")
    expect(deriveStage(999_999)).toBe("legendary")
  })
})

describe("stageProgress", () => {
  it("reports the fraction into the current stage", () => {
    expect(stageProgress(0)).toEqual({
      stage: "egg",
      nextStage: "hatchling",
      xpIntoStage: 0,
      xpForNextStage: 50,
      fraction: 0,
    })

    expect(stageProgress(25)).toMatchObject({
      stage: "egg",
      xpIntoStage: 25,
      fraction: 0.5,
    })
  })

  it("starts the next stage at zero progress", () => {
    expect(stageProgress(50)).toMatchObject({
      stage: "hatchling",
      nextStage: "juvenile",
      xpIntoStage: 0,
      fraction: 0,
    })
  })

  it("reports a full bar at the highest stage", () => {
    expect(stageProgress(2000)).toMatchObject({
      stage: "legendary",
      nextStage: null,
      fraction: 1,
    })
    expect(stageProgress(99_999).fraction).toBe(1)
  })
})

describe("calcStreak", () => {
  it("keeps the streak on the same local day", () => {
    expect(
      calcStreak(
        { streakCount: 3, bestStreak: 5, lastStreakDate: TODAY },
        TODAY,
      ),
    ).toEqual({
      streakCount: 3,
      bestStreak: 5,
      lastStreakDate: TODAY,
    })
  })

  it("adds one for the next day", () => {
    expect(
      calcStreak(
        { streakCount: 3, bestStreak: 5, lastStreakDate: YESTERDAY },
        TODAY,
      ).streakCount,
    ).toBe(4)
  })

  it("adds one when the gap is within the grace window", () => {
    for (const gap of [2, 7]) {
      expect(
        calcStreak(
          { streakCount: 1, bestStreak: 1, lastStreakDate: dayKey(-gap) },
          TODAY,
        ).streakCount,
      ).toBe(2)
    }
  })

  it("resets after a gap longer than the grace window", () => {
    expect(
      calcStreak(
        { streakCount: 9, bestStreak: 9, lastStreakDate: dayKey(-8) },
        TODAY,
      ).streakCount,
    ).toBe(1)
  })

  it("starts at one when there is no previous date", () => {
    expect(
      calcStreak(
        { streakCount: 7, bestStreak: 7, lastStreakDate: null },
        TODAY,
      ),
    ).toEqual({ streakCount: 1, bestStreak: 7, lastStreakDate: TODAY })
  })

  it("keeps the streak when the stored date is ahead of today", () => {
    expect(
      calcStreak(
        {
          streakCount: 4,
          bestStreak: 6,
          lastStreakDate: dayKey(1),
        },
        TODAY,
      ),
    ).toEqual({ streakCount: 4, bestStreak: 6, lastStreakDate: TODAY })
  })

  it("keeps the best streak at or above the current one", () => {
    expect(
      calcStreak(
        { streakCount: 2, bestStreak: 2, lastStreakDate: YESTERDAY },
        TODAY,
      ).bestStreak,
    ).toBe(3)

    expect(
      calcStreak(
        { streakCount: 2, bestStreak: 10, lastStreakDate: YESTERDAY },
        TODAY,
      ).bestStreak,
    ).toBe(10)
  })
})

describe("applyCareTokenGrant", () => {
  it("counts sessions 1–4 without granting a token", () => {
    for (let sessions = 0; sessions < 4; sessions += 1) {
      expect(
        applyCareTokenGrant({
          careTokens: 0,
          sessionsSinceLastToken: sessions,
        }),
      ).toEqual({
        careTokens: 0,
        sessionsSinceLastToken: sessions + 1,
      })
    }
  })

  it("grants a token on the fifth session and resets the counter", () => {
    expect(
      applyCareTokenGrant({ careTokens: 1, sessionsSinceLastToken: 4 }),
    ).toEqual({ careTokens: 2, sessionsSinceLastToken: 0 })
  })

  it("holds the counter at five while tokens are capped", () => {
    expect(
      applyCareTokenGrant({
        careTokens: config.careTokens.cap,
        sessionsSinceLastToken: 4,
      }),
    ).toEqual({
      careTokens: config.careTokens.cap,
      sessionsSinceLastToken: 5,
    })

    expect(
      applyCareTokenGrant({
        careTokens: config.careTokens.cap,
        sessionsSinceLastToken: 5,
      }),
    ).toEqual({
      careTokens: config.careTokens.cap,
      sessionsSinceLastToken: 5,
    })
  })

  it("grants on the next session after a token is spent", () => {
    expect(
      applyCareTokenGrant({
        careTokens: config.careTokens.cap - 1,
        sessionsSinceLastToken: 5,
      }),
    ).toEqual({
      careTokens: config.careTokens.cap,
      sessionsSinceLastToken: 0,
    })
  })

  it("never exceeds the cap", () => {
    expect(
      applyCareTokenGrant({
        careTokens: config.careTokens.cap,
        sessionsSinceLastToken: 4,
      }).careTokens,
    ).toBe(config.careTokens.cap)
  })
})

describe("buildSessionCommit", () => {
  it("creates a row for a new word and pays the completion bonus", () => {
    const result = makeResult(
      [makeWord("w-bag", [makeAttempt({ xp: 2 })])],
      2,
    )
    const { payload, summary } = buildSessionCommit(
      result,
      makeProfile(),
      [],
      NOW,
    )

    expect(payload).toMatchObject({
      profileId: 1,
      now: NOW,
      xpEarned: 7,
    })
    expect(payload.progress).toEqual([
      {
        wordId: "w-bag",
        status: "learning",
        strength: 0.2,
        nextReviewAt: NOW + 2 * DAY,
        correctCount: 1,
        wrongCount: 0,
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        masteryXpAwarded: false,
      },
    ])
    expect(validateSessionPayload(payload)).toEqual([])
    expect(summary).toMatchObject({
      wordsPracticed: 1,
      wordsMastered: 0,
      xpEarned: 7,
      stageBefore: "egg",
      stageAfter: "hatchling",
      streakCount: 3,
      careTokens: 1,
      sessionsSinceLastToken: 0,
    })
    expect(summary.progress.stage).toBe("hatchling")
  })

  it("preserves firstSeenAt and updates lastSeenAt on an existing row", () => {
    const existing = makeProgress({
      wordId: "w-key",
      strength: 0.4,
      correctCount: 1,
      firstSeenAt: NOW - 30 * DAY,
    })
    const result = makeResult(
      [makeWord("w-key", [makeAttempt({ wordId: "w-key" })])],
      2,
    )
    const { payload } = buildSessionCommit(
      result,
      makeProfile(),
      [existing],
      NOW,
    )

    expect(payload.progress[0]).toMatchObject({
      wordId: "w-key",
      strength: 0.6,
      correctCount: 2,
      firstSeenAt: NOW - 30 * DAY,
      lastSeenAt: NOW,
    })
    expect(payload.progress[0].nextReviewAt).toBe(NOW + 7 * DAY)
  })

  it("learns a word whose answer was revealed", () => {
    const result = makeResult(
      [
        makeWord("w-bag", [
          makeAttempt({
            correct: false,
            revealed: true,
            wrongTaps: 3,
            hintLevel: 2,
            xp: 0,
          }),
        ]),
      ],
      0,
    )
    const { payload } = buildSessionCommit(
      result,
      makeProfile(),
      [],
      NOW,
    )

    expect(payload.progress[0]).toMatchObject({
      wordId: "w-bag",
      status: "learning",
      strength: 0,
      correctCount: 0,
      wrongCount: 3,
      firstSeenAt: NOW,
      lastSeenAt: NOW,
    })
    expect(payload.progress[0].nextReviewAt).toBe(NOW + DAY)
    expect(payload.metrics[METRIC_NAMES.wordLearned]).toBe(1)
  })

  it("nets -0.1 when a word is missed then answered", () => {
    const existing = makeProgress({ strength: 0.3, correctCount: 1 })
    const result = makeResult(
      [
        makeWord("w-bag", [
          makeAttempt({ wrongTaps: 1, hintLevel: 1, xp: 1 }),
        ]),
      ],
      1,
    )
    const { payload } = buildSessionCommit(
      result,
      makeProfile(),
      [existing],
      NOW,
    )

    expect(payload.progress[0]).toMatchObject({
      strength: 0.2,
      correctCount: 2,
      wrongCount: 1,
    })
  })

  it("awards mastery XP on the first transition to mastered", () => {
    const existing = makeProgress({
      strength: 0.6,
      correctCount: 2,
      firstSeenAt: NOW - 30 * DAY,
    })
    const result = makeResult(
      [makeWord("w-bag", [makeAttempt({ xp: 2 })])],
      2,
    )
    const { payload, summary } = buildSessionCommit(
      result,
      makeProfile(),
      [existing],
      NOW,
    )

    expect(payload.progress[0]).toMatchObject({
      status: "mastered",
      strength: 0.8,
      correctCount: 3,
      masteryXpAwarded: true,
    })
    expect(payload.progress[0].nextReviewAt).toBe(NOW + 14 * DAY)
    expect(payload.xpEarned).toBe(17)
    expect(payload.metrics[METRIC_NAMES.wordMastered]).toBe(1)
    expect(summary.wordsMastered).toBe(1)
    expect(summary.xpEarned).toBe(17)
  })

  it("does not award mastery XP again after a demotion and re-mastery", () => {
    const existing = makeProgress({
      status: "learning",
      strength: 0.4,
      correctCount: 3,
      masteryXpAwarded: true,
    })
    const result = makeResult(
      [
        makeWord("w-bag", [
          makeAttempt({ xp: 2 }),
          makeAttempt({ xp: 2 }),
        ]),
      ],
      4,
    )
    const { payload, summary } = buildSessionCommit(
      result,
      makeProfile(),
      [existing],
      NOW,
    )

    expect(payload.progress[0]).toMatchObject({
      status: "mastered",
      strength: 0.8,
      masteryXpAwarded: true,
    })
    expect(payload.xpEarned).toBe(9)
    expect(summary.wordsMastered).toBe(0)
    expect(payload.metrics[METRIC_NAMES.wordMastered]).toBeUndefined()
  })

  it("keeps a mastered word mastered while strength stays at or above 0.5", () => {
    const existing = makeProgress({
      status: "mastered",
      strength: 0.9,
      correctCount: 5,
      masteryXpAwarded: true,
    })
    const result = makeResult(
      [
        makeWord("w-bag", [
          makeAttempt({
            correct: false,
            revealed: true,
            wrongTaps: 1,
            hintLevel: 1,
            xp: 0,
          }),
        ]),
      ],
      0,
    )
    const { payload } = buildSessionCommit(
      result,
      makeProfile(),
      [existing],
      NOW,
    )

    expect(payload.progress[0]).toMatchObject({
      status: "mastered",
      strength: 0.6,
      masteryXpAwarded: true,
    })
    expect(payload.progress[0].nextReviewAt).toBe(NOW + 7 * DAY)
  })

  it("demotes a mastered word below 0.5 without clearing masteryXpAwarded", () => {
    const existing = makeProgress({
      status: "mastered",
      strength: 0.9,
      correctCount: 5,
      masteryXpAwarded: true,
    })
    const result = makeResult(
      [
        makeWord("w-bag", [
          makeAttempt({
            correct: false,
            revealed: true,
            wrongTaps: 3,
            hintLevel: 2,
            xp: 0,
          }),
        ]),
      ],
      0,
    )
    const { payload } = buildSessionCommit(
      result,
      makeProfile(),
      [existing],
      NOW,
    )

    expect(payload.progress[0]).toMatchObject({
      status: "learning",
      strength: 0,
      masteryXpAwarded: true,
    })
    expect(payload.metrics[METRIC_NAMES.wordMastered]).toBeUndefined()
  })

  it("patches the profile, streak, care tokens, and metrics", () => {
    const result = makeResult(
      [makeWord("w-bag", [makeAttempt({ xp: 2 })])],
      2,
    )
    const { payload } = buildSessionCommit(
      result,
      makeProfile({ xp: 45 }),
      [],
      NOW,
    )

    expect(payload.profile).toMatchObject({
      xp: 52,
      lastPracticeAt: NOW,
      frozenDays: 0,
      completedSessions: 8,
      streakCount: 3,
      bestStreak: 5,
      lastStreakDate: TODAY,
      careTokens: 1,
      sessionsSinceLastToken: 0,
    })
    expect(payload.profile.lastMonthlyReviewAt).toBeUndefined()
    expect(payload.metrics).toMatchObject({
      [METRIC_NAMES.sessionCompleted]: 1,
      [METRIC_NAMES.wordLearned]: 1,
      [METRIC_NAMES.stageUp]: 1,
      [METRIC_NAMES.xpEarned]: 7,
    })
  })

  it("records one stage-up per threshold crossed", () => {
    // 40 + 260 answer XP + 5 completion = 305: egg → juvenile.
    const result = makeResult([], 260)
    const { payload } = buildSessionCommit(
      result,
      makeProfile({ xp: 40 }),
      [],
      NOW,
    )

    expect(payload.metrics[METRIC_NAMES.stageUp]).toBe(2)
  })

  it("records no stage-up when the stage does not change", () => {
    const result = makeResult([], 0)
    const { payload } = buildSessionCommit(
      result,
      makeProfile({ xp: 280 }),
      [],
      NOW,
    )

    // 280 + 5 = 285: juvenile → juvenile.
    expect(payload.metrics[METRIC_NAMES.stageUp]).toBeUndefined()
  })

  it("records a revival when a sleeping character completes a session", () => {
    const result = makeResult([], 0)
    const { payload } = buildSessionCommit(
      result,
      makeProfile({ lastPracticeAt: NOW - 8 * DAY, frozenDays: 0 }),
      [],
      NOW,
    )

    expect(payload.metrics[METRIC_NAMES.revivalSession]).toBe(1)
  })

  it("records no revival for an awake character", () => {
    const result = makeResult([], 0)
    const { payload } = buildSessionCommit(
      result,
      makeProfile({ lastPracticeAt: NOW - DAY, frozenDays: 0 }),
      [],
      NOW,
    )

    expect(payload.metrics[METRIC_NAMES.revivalSession]).toBeUndefined()
  })

  it("marks a monthly review as completed", () => {
    const result = makeResult([], 0, "monthly")
    const { payload } = buildSessionCommit(
      result,
      makeProfile(),
      [],
      NOW,
    )

    expect(payload.profile.lastMonthlyReviewAt).toBe(NOW)
  })

  it("counts only new rows as learned words", () => {
    const existing = makeProgress({ wordId: "w-key" })
    const result = makeResult(
      [
        makeWord("w-bag", [makeAttempt({ xp: 2 })]),
        makeWord("w-key", [makeAttempt({ wordId: "w-key", xp: 2 })]),
      ],
      4,
    )
    const { payload } = buildSessionCommit(
      result,
      makeProfile(),
      [existing],
      NOW,
    )

    expect(payload.progress).toHaveLength(2)
    expect(payload.metrics[METRIC_NAMES.wordLearned]).toBe(1)
  })

  it("leaves a word with no attempts without a row", () => {
    const result = makeResult([makeWord("w-bag", [])], 0)
    const { payload } = buildSessionCommit(
      result,
      makeProfile(),
      [],
      NOW,
    )

    expect(payload.progress).toEqual([])
    expect(payload.metrics[METRIC_NAMES.wordLearned]).toBeUndefined()
  })
})

describe("monthly review commit", () => {
  it("applies the same strength rules and recomputes nextReviewAt", () => {
    const existing = makeProgress({
      wordId: "w-bag",
      strength: 0.4,
      correctCount: 2,
      lastSeenAt: NOW - 2 * DAY,
    })
    const result = makeResult(
      [makeWord("w-bag", [makeAttempt({ wordId: "w-bag", xp: 2 })])],
      2,
      "monthly",
    )
    const { payload } = buildSessionCommit(
      result,
      makeProfile(),
      [existing],
      NOW,
    )

    expect(payload.progress[0]).toMatchObject({
      wordId: "w-bag",
      status: "learning",
      strength: 0.6,
      nextReviewAt: nextReviewAt(0.6, NOW),
      lastSeenAt: NOW,
      correctCount: 3,
    })
    expect(payload.profile.lastMonthlyReviewAt).toBe(NOW)
  })

  it("demotes a mastered word whose strength falls below 0.5", () => {
    const existing = makeProgress({
      wordId: "w-bag",
      status: "mastered",
      strength: 0.6,
      correctCount: 5,
      masteryXpAwarded: true,
    })
    const result = makeResult(
      [
        makeWord("w-bag", [
          makeAttempt({ wordId: "w-bag", wrongTaps: 2, xp: 2 }),
        ]),
      ],
      2,
      "monthly",
    )
    const { payload } = buildSessionCommit(
      result,
      makeProfile(),
      [existing],
      NOW,
    )

    // 0.6 − 0.3 − 0.3 + 0.2 = 0.2.
    expect(payload.progress[0]).toMatchObject({
      status: "learning",
      strength: 0.2,
      masteryXpAwarded: true,
    })
    expect(payload.metrics[METRIC_NAMES.wordMastered]).toBeUndefined()
  })

  it("counts the review as a completed session and a streak day", () => {
    const result = makeResult(
      [makeWord("w-bag", [makeAttempt({ wordId: "w-bag", xp: 2 })])],
      2,
      "monthly",
    )
    const { payload } = buildSessionCommit(
      result,
      makeProfile({ completedSessions: 7, streakCount: 2 }),
      [makeProgress({ wordId: "w-bag", strength: 0.4 })],
      NOW,
    )

    expect(payload.profile).toMatchObject({
      lastPracticeAt: NOW,
      completedSessions: 8,
      streakCount: 3,
      lastStreakDate: TODAY,
    })
    expect(payload.xpEarned).toBe(7)
    expect(payload.metrics).toMatchObject({
      [METRIC_NAMES.sessionCompleted]: 1,
      [METRIC_NAMES.monthlyReviewCompleted]: 1,
      [METRIC_NAMES.xpEarned]: 7,
    })
    expect(payload.metrics[METRIC_NAMES.reviewStrengthDelta]).toBeCloseTo(
      0.2,
      5,
    )
  })

  it("counts strong words and those wanting another visit", () => {
    const result = makeResult(
      [
        makeWord("w-strong", [makeAttempt({ wordId: "w-strong", xp: 2 })]),
        makeWord("w-weak", [makeAttempt({ wordId: "w-weak", xp: 2 })]),
      ],
      4,
      "monthly",
    )
    const { summary } = buildSessionCommit(
      result,
      makeProfile(),
      [
        makeProgress({ wordId: "w-strong", status: "mastered", strength: 0.8 }),
        makeProgress({ wordId: "w-weak", strength: 0.4 }),
      ],
      NOW,
    )

    expect(summary.review).toEqual({
      reviewed: 2,
      strong: 1,
      needsVisit: 1,
    })
  })

  it("leaves a daily session without a review summary", () => {
    const result = makeResult([], 0)
    const { summary } = buildSessionCommit(result, makeProfile(), [], NOW)

    expect(summary.review).toBeNull()
  })
})
