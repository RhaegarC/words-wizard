import { describe, expect, it } from "vitest"

import { config } from "./config"
import { buildSessionCommit } from "./progression"
import {
  canFreeze,
  canQuickWake,
  deriveCharacterState,
  deriveVitality,
  spendOnFreeze,
  spendOnQuickWake,
} from "./character"
import { localDateKey, startOfLocalDay } from "./time"
import type { Profile, SessionResult } from "./types"

const NOW = new Date(2026, 9, 21, 12, 0, 0).getTime()
const DAY = 86_400_000

function dayKey(offset: number): string {
  return localDateKey(startOfLocalDay(NOW) + offset * DAY)
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
    createdAt: NOW - 120 * DAY,
    lastPracticeAt: NOW - 2 * DAY,
    lastWakeAt: null,
    frozenDays: 0,
    careTokens: 2,
    sessionsSinceLastToken: 3,
    completedSessions: 7,
    streakCount: 4,
    bestStreak: 6,
    lastStreakDate: dayKey(-2),
    lastMonthlyReviewAt: null,
    locale: "en",
    ...overrides,
  }
}

function makeResult(): SessionResult {
  return {
    id: "session-1",
    kind: "daily",
    startedAt: NOW - 300_000,
    completedAt: NOW,
    words: [],
    xpEarned: 0,
  }
}

describe("deriveVitality", () => {
  it("starts full and falls by the configured amount per idle day", () => {
    expect(deriveVitality(0)).toBe(100)
    expect(deriveVitality(3)).toBe(55)
    expect(deriveVitality(4)).toBe(40)
    expect(deriveVitality(7)).toBe(0)
  })

  it("clamps outside 0–100", () => {
    expect(deriveVitality(-2)).toBe(100)
    expect(deriveVitality(30)).toBe(0)
  })
})

describe("deriveCharacterState", () => {
  it("is awake on the day of practice", () => {
    const state = deriveCharacterState(
      makeProfile({ lastPracticeAt: NOW - 60_000 }),
      NOW,
    )

    expect(state.effectiveDaysIdle).toBe(0)
    expect(state.state).toBe("awake")
    expect(state.vitality).toBe(100)
  })

  it("is awake on day 3", () => {
    const state = deriveCharacterState(
      makeProfile({ lastPracticeAt: NOW - 3 * DAY }),
      NOW,
    )

    expect(state.effectiveDaysIdle).toBe(3)
    expect(state.state).toBe("awake")
    expect(state.vitality).toBe(55)
  })

  it("is sleepy from day 4 to day 6", () => {
    expect(
      deriveCharacterState(makeProfile({ lastPracticeAt: NOW - 4 * DAY }), NOW)
        .state,
    ).toBe("sleepy")
    expect(
      deriveCharacterState(makeProfile({ lastPracticeAt: NOW - 6 * DAY }), NOW)
        .state,
    ).toBe("sleepy")
  })

  it("is sleeping from day 7", () => {
    const state = deriveCharacterState(
      makeProfile({ lastPracticeAt: NOW - 7 * DAY }),
      NOW,
    )

    expect(state.effectiveDaysIdle).toBe(7)
    expect(state.state).toBe("sleeping")
    expect(state.vitality).toBe(0)
  })

  it("stays asleep at day 30 with zero vitality", () => {
    const state = deriveCharacterState(
      makeProfile({ lastPracticeAt: NOW - 30 * DAY }),
      NOW,
    )

    expect(state.effectiveDaysIdle).toBe(30)
    expect(state.state).toBe("sleeping")
    expect(state.vitality).toBe(0)
  })

  it("uses the most recent of created, practiced, and woken", () => {
    const profile = makeProfile({
      createdAt: NOW - 100 * DAY,
      lastPracticeAt: NOW - 10 * DAY,
      lastWakeAt: NOW - 2 * DAY,
    })

    expect(deriveCharacterState(profile, NOW).effectiveDaysIdle).toBe(2)
  })

  it("subtracts frozen days exactly and never goes below zero", () => {
    const practice = NOW - 5 * DAY

    expect(
      deriveCharacterState(
        makeProfile({ lastPracticeAt: practice, frozenDays: 2 }),
        NOW,
      ).effectiveDaysIdle,
    ).toBe(3)
    expect(
      deriveCharacterState(
        makeProfile({ lastPracticeAt: practice, frozenDays: 10 }),
        NOW,
      ).effectiveDaysIdle,
    ).toBe(0)
  })

  it("treats a future anchor as zero idle days", () => {
    const state = deriveCharacterState(
      makeProfile({ lastPracticeAt: NOW + 3 * DAY }),
      NOW,
    )

    expect(state.effectiveDaysIdle).toBe(0)
    expect(state.vitality).toBe(100)
  })

  it("derives the stage from XP", () => {
    const cases: Array<[number, string]> = [
      [0, "egg"],
      [49, "egg"],
      [50, "hatchling"],
      [299, "hatchling"],
      [300, "juvenile"],
      [899, "juvenile"],
      [900, "adult"],
      [1999, "adult"],
      [2000, "legendary"],
    ]

    for (const [xp, stage] of cases) {
      expect(deriveCharacterState(makeProfile({ xp }), NOW).stage).toBe(stage)
    }
  })

  it("returns to awake after a completed session", () => {
    const sleeping = makeProfile({
      lastPracticeAt: NOW - 10 * DAY,
      lastStreakDate: dayKey(-10),
    })
    const { payload } = buildSessionCommit(makeResult(), sleeping, [], NOW)
    const next = { ...sleeping, ...payload.profile }

    expect(deriveCharacterState(sleeping, NOW).state).toBe("sleeping")
    expect(deriveCharacterState(next, NOW).state).toBe("awake")
    expect(next.careTokens).toBe(sleeping.careTokens)
  })
})

describe("canFreeze", () => {
  it("allows a freeze while awake", () => {
    expect(
      canFreeze(makeProfile({ lastPracticeAt: NOW - 60_000 }), NOW),
    ).toEqual({ allowed: true })
  })

  it("allows a freeze while sleepy", () => {
    expect(
      canFreeze(makeProfile({ lastPracticeAt: NOW - 4 * DAY }), NOW),
    ).toEqual({ allowed: true })
  })

  it("rejects a freeze while sleeping, even with tokens", () => {
    expect(
      canFreeze(
        makeProfile({ lastPracticeAt: NOW - 8 * DAY, careTokens: 3 }),
        NOW,
      ),
    ).toEqual({ allowed: false, reason: "sleeping" })
  })

  it("rejects a freeze with no tokens", () => {
    expect(canFreeze(makeProfile({ careTokens: 0 }), NOW)).toEqual({
      allowed: false,
      reason: "no-tokens",
    })
  })
})

describe("canQuickWake", () => {
  it("allows a quick wake while sleeping", () => {
    expect(
      canQuickWake(makeProfile({ lastPracticeAt: NOW - 8 * DAY }), NOW),
    ).toEqual({ allowed: true })
  })

  it("rejects a quick wake while awake", () => {
    expect(
      canQuickWake(makeProfile({ lastPracticeAt: NOW - 60_000 }), NOW),
    ).toEqual({ allowed: false, reason: "not-sleeping" })
  })

  it("rejects a quick wake while sleepy", () => {
    expect(
      canQuickWake(makeProfile({ lastPracticeAt: NOW - 4 * DAY }), NOW),
    ).toEqual({ allowed: false, reason: "not-sleeping" })
  })

  it("rejects a quick wake with no tokens", () => {
    expect(
      canQuickWake(
        makeProfile({ lastPracticeAt: NOW - 8 * DAY, careTokens: 0 }),
        NOW,
      ),
    ).toEqual({ allowed: false, reason: "no-tokens" })
  })
})

describe("spendOnFreeze", () => {
  it("spends one token and extends dormancy by one day", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - 3 * DAY,
      frozenDays: 1,
      careTokens: 2,
      sessionsSinceLastToken: 3,
    })
    const outcome = spendOnFreeze(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.careTokens).toBe(1)
    expect(outcome.profile.frozenDays).toBe(2)
    expect(outcome.profile.sessionsSinceLastToken).toBe(3)
  })

  it("counts a covered missed day inside the grace window", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - 3 * DAY,
      lastStreakDate: dayKey(-3),
      streakCount: 4,
      bestStreak: 6,
    })
    const outcome = spendOnFreeze(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.streakCount).toBe(5)
    expect(outcome.profile.bestStreak).toBe(6)
    expect(outcome.profile.lastStreakDate).toBe(YESTERDAY)
  })

  it("raises the best streak when the covered day sets a new record", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - 3 * DAY,
      lastStreakDate: dayKey(-3),
      streakCount: 6,
      bestStreak: 6,
    })
    const outcome = spendOnFreeze(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.streakCount).toBe(7)
    expect(outcome.profile.bestStreak).toBe(7)
  })

  it("leaves the streak unchanged when the child practiced today", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - 60_000,
      lastStreakDate: TODAY,
      streakCount: 4,
    })
    const outcome = spendOnFreeze(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.streakCount).toBe(4)
    expect(outcome.profile.lastStreakDate).toBe(TODAY)
    expect(outcome.profile.frozenDays).toBe(1)
  })

  it("leaves the streak unchanged when the child practiced yesterday", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - DAY,
      lastStreakDate: YESTERDAY,
      streakCount: 4,
    })
    const outcome = spendOnFreeze(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.streakCount).toBe(4)
    expect(outcome.profile.lastStreakDate).toBe(YESTERDAY)
  })

  it("leaves the streak unchanged when there is no recorded streak day", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - 2 * DAY,
      lastStreakDate: null,
      streakCount: 0,
    })
    const outcome = spendOnFreeze(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.streakCount).toBe(0)
    expect(outcome.profile.lastStreakDate).toBeNull()
  })

  it("leaves the streak unchanged outside the grace window", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - 2 * DAY,
      lastStreakDate: dayKey(-10),
      streakCount: 4,
    })
    const outcome = spendOnFreeze(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.streakCount).toBe(4)
    expect(outcome.profile.lastStreakDate).toBe(dayKey(-10))
  })

  it("rejects a freeze while sleeping without changing anything", () => {
    const profile = makeProfile({ lastPracticeAt: NOW - 8 * DAY })
    const outcome = spendOnFreeze(profile, NOW)

    expect(outcome).toMatchObject({ spent: false, reason: "sleeping" })
    expect(outcome.profile).toEqual(profile)
  })

  it("rejects a freeze with no tokens without changing anything", () => {
    const profile = makeProfile({ careTokens: 0 })
    const outcome = spendOnFreeze(profile, NOW)

    expect(outcome).toMatchObject({ spent: false, reason: "no-tokens" })
    expect(outcome.profile).toEqual(profile)
  })

  it("re-grants the queued token at the cap", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - 3 * DAY,
      careTokens: config.careTokens.cap,
      sessionsSinceLastToken: config.careTokens.sessionsPerToken,
    })
    const outcome = spendOnFreeze(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.careTokens).toBe(config.careTokens.cap)
    expect(outcome.profile.sessionsSinceLastToken).toBe(0)
  })

  it("still costs a token at the cap when none is queued", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - 3 * DAY,
      careTokens: config.careTokens.cap,
      sessionsSinceLastToken: 4,
    })
    const outcome = spendOnFreeze(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.careTokens).toBe(config.careTokens.cap - 1)
    expect(outcome.profile.sessionsSinceLastToken).toBe(4)
  })
})

describe("spendOnQuickWake", () => {
  it("sets lastWakeAt, clears frozen days, and spends one token", () => {
    const profile = makeProfile({
      // Eight effective days idle: asleep, even with the two frozen days.
      lastPracticeAt: NOW - 10 * DAY,
      frozenDays: 2,
      careTokens: 2,
      sessionsSinceLastToken: 3,
      xp: 120,
      completedSessions: 9,
      streakCount: 4,
      bestStreak: 6,
      lastMonthlyReviewAt: null,
    })
    const outcome = spendOnQuickWake(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.lastWakeAt).toBe(NOW)
    expect(outcome.profile.frozenDays).toBe(0)
    expect(outcome.profile.careTokens).toBe(1)
    expect(outcome.profile).toEqual({
      ...profile,
      lastWakeAt: NOW,
      frozenDays: 0,
      careTokens: 1,
    })
  })

  it("does not touch practice, XP, streak, or session counts", () => {
    const profile = makeProfile({ lastPracticeAt: NOW - 8 * DAY })
    const outcome = spendOnQuickWake(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.lastPracticeAt).toBe(profile.lastPracticeAt)
    expect(outcome.profile.xp).toBe(profile.xp)
    expect(outcome.profile.streakCount).toBe(profile.streakCount)
    expect(outcome.profile.bestStreak).toBe(profile.bestStreak)
    expect(outcome.profile.lastStreakDate).toBe(profile.lastStreakDate)
    expect(outcome.profile.completedSessions).toBe(profile.completedSessions)
    expect(outcome.profile.lastMonthlyReviewAt).toBe(
      profile.lastMonthlyReviewAt,
    )
  })

  it("makes the character awake at the same instant", () => {
    const profile = makeProfile({ lastPracticeAt: NOW - 8 * DAY })
    const outcome = spendOnQuickWake(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(deriveCharacterState(outcome.profile, NOW).state).toBe("awake")
  })

  it("rejects a wake while awake without changing anything", () => {
    const profile = makeProfile({ lastPracticeAt: NOW - 60_000 })
    const outcome = spendOnQuickWake(profile, NOW)

    expect(outcome).toMatchObject({ spent: false, reason: "not-sleeping" })
    expect(outcome.profile).toEqual(profile)
  })

  it("rejects a wake while sleepy without changing anything", () => {
    const profile = makeProfile({ lastPracticeAt: NOW - 4 * DAY })
    const outcome = spendOnQuickWake(profile, NOW)

    expect(outcome).toMatchObject({ spent: false, reason: "not-sleeping" })
    expect(outcome.profile).toEqual(profile)
  })

  it("rejects a wake with no tokens without changing anything", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - 8 * DAY,
      careTokens: 0,
    })
    const outcome = spendOnQuickWake(profile, NOW)

    expect(outcome).toMatchObject({ spent: false, reason: "no-tokens" })
    expect(outcome.profile).toEqual(profile)
  })

  it("re-grants the queued token at the cap", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - 8 * DAY,
      careTokens: config.careTokens.cap,
      sessionsSinceLastToken: config.careTokens.sessionsPerToken,
    })
    const outcome = spendOnQuickWake(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.careTokens).toBe(config.careTokens.cap)
    expect(outcome.profile.sessionsSinceLastToken).toBe(0)
  })

  it("still costs a token at the cap when none is queued", () => {
    const profile = makeProfile({
      lastPracticeAt: NOW - 8 * DAY,
      careTokens: config.careTokens.cap,
      sessionsSinceLastToken: 4,
    })
    const outcome = spendOnQuickWake(profile, NOW)

    expect(outcome.spent).toBe(true)
    expect(outcome.profile.careTokens).toBe(config.careTokens.cap - 1)
    expect(outcome.profile.sessionsSinceLastToken).toBe(4)
  })
})
