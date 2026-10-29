import { describe, expect, it } from "vitest"

import { config } from "./config"

describe("config", () => {
  it("opens the stage ladder at 0 XP and ascends strictly", () => {
    expect(config.stages[0].minXp).toBe(0)

    for (let index = 1; index < config.stages.length; index += 1) {
      expect(config.stages[index].minXp).toBeGreaterThan(
        config.stages[index - 1].minXp,
      )
    }

    expect(config.stages.map((stage) => stage.id)).toEqual([
      "egg",
      "hatchling",
      "juvenile",
      "adult",
      "legendary",
    ])
    expect(config.stages.map((stage) => stage.minXp)).toEqual([
      0, 50, 300, 900, 2000,
    ])
  })

  it("matches the PRD §7.2 XP awards", () => {
    expect(config.xp).toEqual({
      firstTry: 2,
      afterHint: 1,
      mastered: 10,
      sessionComplete: 5,
    })
  })

  it("matches the PRD §5 five-word daily session", () => {
    expect(config.session).toEqual({
      newWords: 5,
      newWordModes: ["spellingBuilder"],
      secondsPerScreen: 25,
    })
  })

  it("matches the PRD §7.1 streak and §7.2 dormancy rules", () => {
    expect(config.streak).toEqual({ graceDays: 7, tokenCoversDays: 1 })
    expect(config.dormancy).toEqual({
      sleepyDay: 4,
      sleepDay: 7,
      vitalityPerDay: 15,
    })
  })

  it("matches the PRD §7.5 Care Token cadence and cap", () => {
    expect(config.careTokens).toEqual({
      sessionsPerToken: 5,
      cap: 3,
      hintWithin: 2,
    })
  })

  it("matches the PRD §9 scheduler", () => {
    expect(config.scheduler).toEqual({
      correctDelta: 0.2,
      wrongDelta: -0.3,
      masteredStrength: 0.8,
      masteredCorrect: 3,
      demoteStrength: 0.5,
      intervals: [1, 2, 4, 7, 14, 30],
    })
  })

  it("matches the PRD §7.4 Monthly Review values", () => {
    expect(config.monthlyReview).toEqual({
      intervalDays: 28,
      minLearned: 5,
      cap: 20,
      highStrengthConfirmations: 3,
    })
  })

  it("has no mastery-count unlock thresholds; packs open by completion", () => {
    expect(config).not.toHaveProperty("unlock")
  })

  it("marks a word recently learned inside a seven-local-day window", () => {
    expect(config.myWords).toEqual({ recentlyLearnedDays: 7 })
  })

  it("matches the PRD §12 speech settings", () => {
    expect(config.speech).toEqual({ rate: 0.85, pitch: 1 })
  })
})
