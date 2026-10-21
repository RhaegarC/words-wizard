import { describe, expect, it } from "vitest"

import { isMonthlyReviewDue } from "./monthlyReview"
import type { Profile, Progress } from "./types"

const NOW = new Date(2026, 9, 21, 12, 0, 0).getTime()
const DAY = 86_400_000

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
    lastPracticeAt: NOW - DAY,
    lastWakeAt: null,
    frozenDays: 0,
    careTokens: 1,
    sessionsSinceLastToken: 2,
    completedSessions: 7,
    streakCount: 4,
    bestStreak: 6,
    lastStreakDate: null,
    lastMonthlyReviewAt: null,
    locale: "en",
    ...overrides,
  }
}

function learnedWord(
  wordId: string,
  firstSeenAt: number,
  overrides: Partial<Progress> = {},
): Progress {
  return {
    id: undefined,
    profileId: 1,
    wordId,
    status: "learning",
    strength: 0.4,
    nextReviewAt: NOW,
    correctCount: 1,
    wrongCount: 0,
    firstSeenAt,
    lastSeenAt: firstSeenAt,
    masteryXpAwarded: false,
    ...overrides,
  }
}

function learnedWords(count: number, firstSeenAt = NOW - 40 * DAY): Progress[] {
  return Array.from({ length: count }, (_, index) =>
    learnedWord(`w-${index}`, firstSeenAt + index * DAY),
  )
}

describe("isMonthlyReviewDue", () => {
  it("is not due before 28 full local days", () => {
    const progress = learnedWords(5)

    expect(
      isMonthlyReviewDue(
        makeProfile({ lastMonthlyReviewAt: NOW - 27 * DAY }),
        progress,
        NOW,
      ),
    ).toBe(false)
    expect(
      isMonthlyReviewDue(
        makeProfile({ lastMonthlyReviewAt: NOW - 28 * DAY }),
        progress,
        NOW,
      ),
    ).toBe(true)
  })

  it("needs at least five learned words", () => {
    expect(
      isMonthlyReviewDue(
        makeProfile({ lastMonthlyReviewAt: NOW - 30 * DAY }),
        learnedWords(4),
        NOW,
      ),
    ).toBe(false)
    expect(
      isMonthlyReviewDue(
        makeProfile({ lastMonthlyReviewAt: NOW - 30 * DAY }),
        learnedWords(5),
        NOW,
      ),
    ).toBe(true)
  })

  it("starts the clock at the fifth learned word when never reviewed", () => {
    const progress = learnedWords(5, NOW - 40 * DAY)
    // The fifth word is 28 days old, the four before it are older.
    progress[4] = learnedWord("w-4", NOW - 28 * DAY)

    expect(isMonthlyReviewDue(makeProfile(), progress, NOW)).toBe(true)

    progress[4] = learnedWord("w-4", NOW - 27 * DAY)

    expect(isMonthlyReviewDue(makeProfile(), progress, NOW)).toBe(false)
  })

  it("orders the fifth word by firstSeenAt, not array order", () => {
    const progress = [
      learnedWord("w-late", NOW - 10 * DAY),
      learnedWord("w-1", NOW - 40 * DAY),
      learnedWord("w-2", NOW - 39 * DAY),
      learnedWord("w-3", NOW - 38 * DAY),
      learnedWord("w-4", NOW - 37 * DAY),
    ]

    // Sorted, the fifth is w-late at 10 days, so no review is due yet.
    expect(isMonthlyReviewDue(makeProfile(), progress, NOW)).toBe(false)
  })

  it("does not count unlearned rows", () => {
    const progress = [
      ...learnedWords(4),
      learnedWord("w-new", NOW - 40 * DAY, { status: "new" }),
    ]

    expect(isMonthlyReviewDue(makeProfile(), progress, NOW)).toBe(false)
  })
})
