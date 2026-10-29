import { describe, expect, it } from "vitest"

import type { Profile } from "@shared/types"
import { profileAtBoot, verifyProfileAfterSession } from "./lifecycle"

const PROFILE: Profile = {
  id: 7,
  name: "Mia",
  characterName: "Luma",
  avatar: "luma",
  currentTopicId: "craft-and-build",
  xp: 120,
  createdAt: 1_759_000_000_000,
  lastPracticeAt: 1_759_500_000_000,
  lastWakeAt: null,
  frozenDays: 0,
  careTokens: 1,
  sessionsSinceLastToken: 2,
  completedSessions: 8,
  streakCount: 3,
  bestStreak: 5,
  lastStreakDate: "2026-10-20",
  lastMonthlyReviewAt: null,
  locale: "zh",
}

describe("profileAtBoot", () => {
  it("reports a stored profile as present", () => {
    expect(profileAtBoot(PROFILE)).toEqual({
      status: "present",
      profile: PROFILE,
    })
  })

  it("reports no profile as absent", () => {
    expect(profileAtBoot(null)).toEqual({ status: "absent" })
  })

  it("treats a profile without a character name as absent", () => {
    expect(profileAtBoot({ ...PROFILE, characterName: "  " })).toEqual({
      status: "absent",
    })
  })
})

describe("verifyProfileAfterSession", () => {
  it("maps a profile re-read after a commit to present", () => {
    expect(verifyProfileAfterSession(PROFILE)).toEqual({
      status: "present",
      profile: PROFILE,
    })
  })

  it("maps a vanished profile to lost", () => {
    expect(verifyProfileAfterSession(null)).toEqual({ status: "lost" })
  })
})
