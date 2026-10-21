import { describe, expect, it } from "vitest"

import { DEVICE_KEYS } from "./device"
import { METRIC_NAMES } from "./metrics"
import type { SessionCommitPayload } from "./provider"
import { validateSessionPayload } from "./payload"

const NOW = 1_760_000_000_000

function completePayload(): SessionCommitPayload {
  return {
    profileId: 1,
    now: NOW,
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
      {
        wordId: "w-key",
        status: "mastered",
        strength: 0.9,
        nextReviewAt: NOW + 7 * 86_400_000,
        correctCount: 3,
        wrongCount: 1,
        firstSeenAt: NOW - 30 * 86_400_000,
        lastSeenAt: NOW,
        masteryXpAwarded: true,
      },
    ],
    metrics: {
      [METRIC_NAMES.sessionCompleted]: 1,
      [METRIC_NAMES.wordMastered]: 1,
    },
    device: {
      [DEVICE_KEYS.lastBootAt]: NOW,
    },
  }
}

describe("validateSessionPayload", () => {
  it("accepts a complete payload", () => {
    expect(validateSessionPayload(completePayload())).toEqual([])
  })

  it("accepts a payload with no profile patch, progress, metrics, or device writes", () => {
    expect(
      validateSessionPayload({
        profileId: 2,
        now: NOW,
        xpEarned: 0,
        profile: {},
        progress: [],
        metrics: {},
      }),
    ).toEqual([])
  })

  it("rejects a missing profileId", () => {
    const payload = completePayload()
    payload.profileId = 0

    expect(validateSessionPayload(payload)).toContain("profile-id-missing")
  })

  it("rejects duplicate word ids within one commit", () => {
    const payload = completePayload()
    payload.progress = [...payload.progress, { ...payload.progress[0] }]

    expect(validateSessionPayload(payload)).toContain("duplicate-word-id")
  })

  it("rejects a progress row with no word id", () => {
    const payload = completePayload()
    payload.progress[0].wordId = "  "

    expect(validateSessionPayload(payload)).toContain("word-id-missing")
  })

  it("rejects a nextReviewAt before the commit time", () => {
    const payload = completePayload()
    payload.progress[0].nextReviewAt = NOW - 1

    expect(validateSessionPayload(payload)).toContain("review-in-past")
  })

  it("accepts a nextReviewAt exactly at the commit time", () => {
    const payload = completePayload()
    payload.progress[0].nextReviewAt = NOW

    expect(validateSessionPayload(payload)).toEqual([])
  })

  it("rejects strength below 0 or above 1", () => {
    for (const strength of [-0.01, 1.01, Number.NaN]) {
      const payload = completePayload()
      payload.progress[0].strength = strength

      expect(validateSessionPayload(payload)).toContain(
        "strength-out-of-range",
      )
    }
  })

  it("accepts the strength bounds", () => {
    for (const strength of [0, 1]) {
      const payload = completePayload()
      payload.progress[0].strength = strength

      expect(validateSessionPayload(payload)).toEqual([])
    }
  })

  it("rejects negative XP", () => {
    const negativeEarned = completePayload()
    negativeEarned.xpEarned = -1

    expect(validateSessionPayload(negativeEarned)).toContain("negative-xp")

    const negativeTotal = completePayload()
    negativeTotal.profile.xp = -5

    expect(validateSessionPayload(negativeTotal)).toContain("negative-xp")
  })

  it("reports every issue rather than stopping at the first", () => {
    const payload = completePayload()
    payload.profileId = 0
    payload.progress[0].strength = 2
    payload.progress[0].nextReviewAt = NOW - 1
    payload.xpEarned = -2

    expect(validateSessionPayload(payload).sort()).toEqual(
      [
        "negative-xp",
        "profile-id-missing",
        "review-in-past",
        "strength-out-of-range",
      ].sort(),
    )
  })
})
