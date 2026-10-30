import { describe, expect, it } from "vitest"

import { config } from "./config"
import {
  buildReview,
  isMonthlyReviewDue,
  selectReviewWords,
} from "./monthlyReview"
import {
  buildSessionResult,
  createSessionState,
  sessionReducer,
  sessionSeed,
} from "./session"
import type { Profile, Progress, Word } from "./types"

const NOW = new Date(2026, 9, 21, 12, 0, 0).getTime()
const DAY = 86_400_000

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "profile-1",
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
    profileId: "profile-1",
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

function makeWord(id: string): Word {
  return {
    id,
    text: id,
    phonetic: "",
    partOfSpeech: "noun",
    meaningEn: "",
    meaningZh: "",
    definitionEn: "",
    definitionZh: "",
    examples: [{ en: "", zh: "" }],
    image: "",
    level: 1,
    tags: [],
    topicIds: [],
  }
}

type ReviewRow = {
  wordId: string
  strength: number
  lastSeenAt: number
  status?: Progress["status"]
}

function reviewRows(rows: readonly ReviewRow[]): Progress[] {
  return rows.map((row) =>
    learnedWord(row.wordId, NOW - 100 * DAY, {
      strength: row.strength,
      lastSeenAt: row.lastSeenAt,
      status: row.status ?? "learning",
    }),
  )
}

function wordsFor(rows: readonly ReviewRow[]): Word[] {
  return rows.map((row) => makeWord(row.wordId))
}

/** 35 rows: 20 low, 3 high, 12 mid — every bucket dated apart. */
function mixedRows(): ReviewRow[] {
  return [
    ...Array.from({ length: 20 }, (_, index) => ({
      wordId: `w-low-${String(index).padStart(2, "0")}`,
      strength: 0.1,
      lastSeenAt: NOW - (60 - index) * DAY,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      wordId: `w-high-${index}`,
      strength: 0.9,
      lastSeenAt: NOW - (50 - index) * DAY,
    })),
    ...Array.from({ length: 12 }, (_, index) => ({
      wordId: `w-mid-${String(index).padStart(2, "0")}`,
      strength: 0.5,
      lastSeenAt: NOW - (40 - index) * DAY,
    })),
  ]
}

describe("selectReviewWords", () => {
  it("reviews every learned word when there are 5", () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      wordId: `w-${index}`,
      strength: 0.4,
      lastSeenAt: NOW - index * DAY,
    }))

    // Oldest `lastSeenAt` first; w-4 was seen four days before w-0.
    expect(selectReviewWords(reviewRows(rows), wordsFor(rows))).toEqual([
      "w-4",
      "w-3",
      "w-2",
      "w-1",
      "w-0",
    ])
  })

  it("reviews every learned word when there are 19", () => {
    const rows = Array.from({ length: 19 }, (_, index) => ({
      wordId: `w-${String(index).padStart(2, "0")}`,
      strength: 0.4,
      lastSeenAt: NOW - index * DAY,
    }))
    const selected = selectReviewWords(reviewRows(rows), wordsFor(rows))

    expect(selected).toHaveLength(19)
    expect(new Set(selected)).toEqual(new Set(rows.map((row) => row.wordId)))
  })

  it("takes 17 low-strength words then 3 high-strength confirmations at 20", () => {
    const rows = [
      ...Array.from({ length: 17 }, (_, index) => ({
        wordId: `w-low-${String(index).padStart(2, "0")}`,
        strength: 0.1 + index * 0.001,
        lastSeenAt: NOW - index * DAY,
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        wordId: `w-high-${index}`,
        strength: 0.9,
        lastSeenAt: NOW - (10 - index) * DAY,
      })),
    ]
    const selected = selectReviewWords(reviewRows(rows), wordsFor(rows))

    expect(selected).toHaveLength(20)
    expect(selected.slice(0, 17)).toEqual(
      rows.slice(0, 17).map((row) => row.wordId),
    )
    expect(selected.slice(17)).toEqual(["w-high-0", "w-high-1", "w-high-2"])
  })

  it("takes 17 low, 3 high, and no mid words from 35", () => {
    const rows = mixedRows()
    const selected = selectReviewWords(reviewRows(rows), wordsFor(rows))

    expect(selected).toHaveLength(config.monthlyReview.cap)
    expect(new Set(selected).size).toBe(selected.length)
    expect(
      selected.filter((wordId) => wordId.startsWith("w-low-")),
    ).toHaveLength(17)
    expect(
      selected.filter((wordId) => wordId.startsWith("w-high-")),
    ).toHaveLength(3)
    expect(
      selected.filter((wordId) => wordId.startsWith("w-mid-")),
    ).toHaveLength(0)
  })

  it("fills the remainder from the oldest words when fewer than 3 are high-strength", () => {
    const rows = [
      ...Array.from({ length: 17 }, (_, index) => ({
        wordId: `w-low-${String(index).padStart(2, "0")}`,
        strength: 0.1,
        lastSeenAt: NOW - (30 - index) * DAY,
      })),
      {
        wordId: "w-high",
        strength: 0.9,
        lastSeenAt: NOW - 30 * DAY,
      },
      ...Array.from({ length: 7 }, (_, index) => ({
        wordId: `w-mid-${String(index).padStart(2, "0")}`,
        strength: 0.5,
        lastSeenAt: NOW - (20 - index) * DAY,
      })),
    ]
    const selected = selectReviewWords(reviewRows(rows), wordsFor(rows))

    expect(selected).toHaveLength(20)
    expect(selected).toContain("w-high")
    // The two oldest mid words fill the two missing confirmations.
    expect(selected).toContain("w-mid-00")
    expect(selected).toContain("w-mid-01")
    expect(selected).not.toContain("w-mid-02")
  })

  it("breaks every tie by wordId and never exceeds the cap", () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      wordId: `w-${String(index).padStart(2, "0")}`,
      strength: 0.4,
      lastSeenAt: NOW - 10 * DAY,
    }))
    const selected = selectReviewWords(reviewRows(rows), wordsFor(rows))

    expect(selected).toHaveLength(20)
    expect(selected).not.toContain("w-20")
    expect(selected).toEqual(rows.slice(0, 20).map((row) => row.wordId))
  })

  it("excludes unlearned rows and words outside the content set", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => ({
        wordId: `w-${index}`,
        strength: 0.4,
        lastSeenAt: NOW - index * DAY,
      })),
      {
        wordId: "w-new",
        status: "new" as const,
        strength: 0.4,
        lastSeenAt: NOW - 10 * DAY,
      },
    ]
    const words = wordsFor(rows.slice(0, 5))
    const selected = selectReviewWords(reviewRows(rows), words)

    expect(new Set(selected)).toEqual(
      new Set(["w-0", "w-1", "w-2", "w-3", "w-4"]),
    )
  })
})

describe("buildReview", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    wordId: `w-${String(index).padStart(2, "0")}`,
    strength: 0.4,
    lastSeenAt: NOW - index * DAY,
  }))
  const progress = reviewRows(rows)
  const words = wordsFor(rows)
  const seed = sessionSeed("profile-1", NOW, "monthly", "dev")

  it("plans one exercise for each selected word and no intro cards", () => {
    const plan = buildReview({
      profile: makeProfile(),
      progress,
      words,
      now: NOW,
      seed,
      speechAvailable: true,
    })

    expect(plan.caughtUp).toBe(false)
    expect(plan.words).toHaveLength(12)
    expect(plan.words.every((word) => word.kind === "review")).toBe(true)
    expect(plan.words.every((word) => word.modes.length === 1)).toBe(true)
  })

  it("reproduces the same review from the same seed", () => {
    const input = {
      profile: makeProfile(),
      progress,
      words,
      now: NOW,
      seed,
      speechAvailable: true,
    }

    expect(buildReview(input)).toEqual(buildReview(input))
  })

  it("caps the review at 20 words", () => {
    const many = Array.from({ length: 35 }, (_, index) => ({
      wordId: `w-${String(index).padStart(2, "0")}`,
      strength: index / 100,
      lastSeenAt: NOW - index * DAY,
    }))
    const plan = buildReview({
      profile: makeProfile(),
      progress: reviewRows(many),
      words: wordsFor(many),
      now: NOW,
      seed,
      speechAvailable: true,
    })

    expect(plan.words).toHaveLength(20)
  })

  it("produces no result when the review is abandoned", () => {
    const plan = buildReview({
      profile: makeProfile(),
      progress,
      words,
      now: NOW,
      seed,
      speechAvailable: true,
    })
    const started = sessionReducer(createSessionState(plan, seed), {
      type: "start",
      now: NOW,
    })
    const abandoned = sessionReducer(started, { type: "abandon" })

    expect(buildSessionResult(abandoned)).toBeNull()
  })
})
