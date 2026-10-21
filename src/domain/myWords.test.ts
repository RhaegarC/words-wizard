import { describe, expect, it } from "vitest"

import {
  applyFilters,
  buildWordDetail,
  countByStatus,
  countByTopic,
  DEFAULT_FILTERS,
  filterByStatus,
  filterByTopic,
  filterRecentlyLearned,
  getCollected,
  getMastered,
  hasActiveFilters,
  type CollectedWord,
} from "./myWords"
import type { Progress, Word } from "./types"

const NOW = new Date(2026, 9, 21, 12, 0, 0).getTime()
const DAY = 86_400_000
const TOPIC_A = "craft-and-build"
const TOPIC_B = "explore"

function makeWord(
  id: string,
  topicIds: string[] = [TOPIC_A],
  overrides: Partial<Word> = {},
): Word {
  return {
    id,
    text: `word-${id}`,
    phonetic: `/${id}/`,
    partOfSpeech: "noun",
    meaningEn: `meaning ${id}`,
    meaningZh: `意思 ${id}`,
    definitionEn: `definition ${id}`,
    definitionZh: `解释 ${id}`,
    examples: [{ en: `An example with ${id}.`, zh: `一个包含 ${id} 的例句。` }],
    image: `image-${id}`,
    level: 1,
    tags: [],
    topicIds,
    ...overrides,
  }
}

function makeProgress(
  wordId: string,
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
    firstSeenAt: NOW - DAY,
    lastSeenAt: NOW - DAY,
    masteryXpAwarded: false,
    ...overrides,
  }
}

const WORDS = [
  makeWord("w1"),
  makeWord("w2", [TOPIC_A, TOPIC_B]),
  makeWord("w3", [TOPIC_B]),
  makeWord("w4"),
  makeWord("w5"),
]

const PROGRESS: Progress[] = [
  makeProgress("w1", { lastSeenAt: NOW - DAY }),
  makeProgress("w2", {
    status: "mastered",
    strength: 0.85,
    lastSeenAt: NOW - 2 * DAY,
  }),
  makeProgress("w1", { lastSeenAt: NOW - 20 * DAY }),
  makeProgress("w2", { status: "mastered", lastSeenAt: NOW - 3 * DAY }),
  makeProgress("w3", { status: "new", lastSeenAt: NOW }),
  makeProgress("w4", {
    firstSeenAt: NOW - 8 * DAY,
    lastSeenAt: NOW - 8 * DAY,
  }),
  makeProgress("w-missing", { lastSeenAt: NOW }),
]

/** A word learned at `firstSeenAt`, regardless of when it was last practised. */
function entry(wordId: string, firstSeenAt: number): CollectedWord {
  return {
    word: makeWord(wordId),
    progress: makeProgress(wordId, { firstSeenAt, lastSeenAt: NOW }),
  }
}

describe("getCollected", () => {
  it("joins learned rows to words and excludes new and missing words", () => {
    const collected = getCollected(PROGRESS, WORDS)

    expect(collected.map((item) => item.word.id)).toEqual(["w1", "w2", "w4"])
  })

  it("keeps a demoted word in the collection but removes it from mastered", () => {
    const demoted = PROGRESS.map((row) =>
      row.wordId === "w2" ? { ...row, status: "learning" as const } : row,
    )

    expect(getCollected(demoted, WORDS).map((item) => item.word.id)).toContain(
      "w2",
    )
    expect(getMastered(demoted, WORDS)).toEqual([])
  })

  it("dedupes one word to its most recent row", () => {
    const collected = getCollected(PROGRESS, WORDS)
    const w1 = collected.filter((item) => item.word.id === "w1")

    expect(w1).toHaveLength(1)
    expect(w1[0].progress.lastSeenAt).toBe(NOW - DAY)
  })

  it("orders by lastSeenAt descending with a word-id tie-break", () => {
    const collected = getCollected(
      [
        makeProgress("w1", { lastSeenAt: NOW - 2 * DAY }),
        makeProgress("w2", { lastSeenAt: NOW - 2 * DAY }),
        makeProgress("w3", { lastSeenAt: NOW - DAY }),
      ],
      WORDS,
    )

    expect(collected.map((item) => item.word.id)).toEqual(["w3", "w1", "w2"])
  })
})

describe("getMastered / countByStatus", () => {
  it("returns only mastered rows", () => {
    expect(getMastered(PROGRESS, WORDS).map((item) => item.word.id)).toEqual([
      "w2",
    ])
  })

  it("counts total, learning, and mastered", () => {
    expect(countByStatus(PROGRESS, WORDS)).toEqual({
      total: 3,
      learning: 2,
      mastered: 1,
    })
  })

  it("moves a demoted word between counts without changing the total", () => {
    const demoted = PROGRESS.map((row) =>
      row.wordId === "w2" ? { ...row, status: "learning" as const } : row,
    )

    expect(countByStatus(demoted, WORDS)).toEqual({
      total: 3,
      learning: 3,
      mastered: 0,
    })
  })
})

describe("countByTopic", () => {
  it("counts a shared word in each topic and orders by count", () => {
    expect(countByTopic(getCollected(PROGRESS, WORDS))).toEqual([
      { topicId: TOPIC_A, count: 3 },
      { topicId: TOPIC_B, count: 1 },
    ])
  })
})

describe("filters", () => {
  it("filters by any of the word's topics", () => {
    const collected = getCollected(PROGRESS, WORDS)
    const topicA = filterByTopic(collected, TOPIC_A).map((item) => item.word.id)
    const topicB = filterByTopic(collected, TOPIC_B).map((item) => item.word.id)

    expect(topicA).toEqual(["w1", "w2", "w4"])
    expect(topicB).toEqual(["w2"])
  })

  it("filters by status or passes everything through", () => {
    const collected = getCollected(PROGRESS, WORDS)

    expect(
      filterByStatus(collected, "mastered").map((item) => item.word.id),
    ).toEqual(["w2"])
    expect(
      filterByStatus(collected, "learning").map((item) => item.word.id),
    ).toEqual(["w1", "w4"])
    expect(filterByStatus(collected, "all")).toEqual(collected)
  })

  it("includes exactly seven local days and excludes eight", () => {
    const entries = [
      entry("w1", NOW - 7 * DAY),
      entry("w2", NOW - 8 * DAY),
      entry("w3", NOW - 1 * DAY),
    ]

    expect(
      filterRecentlyLearned(entries, NOW).map((item) => item.word.id),
    ).toEqual(["w1", "w3"])
  })

  it("does not count a recent review as a recent first learn", () => {
    // Learned a month ago, practised today: `lastSeenAt` is fresh, but the
    // word did not enter the collection this week.
    expect(filterRecentlyLearned([entry("w1", NOW - 30 * DAY)], NOW)).toEqual(
      [],
    )
  })

  it("counts local days, not 24-hour blocks, across a DST change", () => {
    // US DST ends on 1 November 2026. Both instants are 7 local days apart,
    // but the elapsed time is longer than seven 24-hour blocks.
    const now = new Date(2026, 10, 8, 12, 0).getTime()
    const seen = new Date(2026, 10, 1, 0, 30).getTime()

    expect(now - seen).toBeGreaterThan(7 * DAY)
    expect(
      filterRecentlyLearned([entry("w1", seen)], now).map(
        (item) => item.word.id,
      ),
    ).toEqual(["w1"])
  })

  it("applies the topic filter through the combiner", () => {
    const collected = getCollected(PROGRESS, WORDS)

    expect(
      applyFilters(
        collected,
        { topicId: TOPIC_B, status: "all", recentlyLearned: false },
        NOW,
      ).map((item) => item.word.id),
    ).toEqual(["w2"])
  })

  it("combines filters and clearing restores every row", () => {
    const collected = getCollected(PROGRESS, WORDS)
    const filtered = applyFilters(
      collected,
      { topicId: TOPIC_A, status: "learning", recentlyLearned: true },
      NOW,
    )

    expect(filtered.map((item) => item.word.id)).toEqual(["w1"])
    expect(applyFilters(collected, DEFAULT_FILTERS, NOW)).toEqual(collected)
  })

  it("reports whether any filter is active", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, topicId: TOPIC_A })).toBe(
      true,
    )
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, status: "mastered" })).toBe(
      true,
    )
    expect(
      hasActiveFilters({ ...DEFAULT_FILTERS, recentlyLearned: true }),
    ).toBe(true)
  })
})

describe("buildWordDetail", () => {
  const word = makeWord("w2", [TOPIC_A, TOPIC_B], {
    phonetic: "/wɜːd/",
    image: "w2.png",
  })

  it("localizes meaning and definition, and always carries both languages of the example", () => {
    const en = buildWordDetail(
      word,
      makeProgress("w2", { status: "mastered", strength: 0.85 }),
      "en",
    )
    const zh = buildWordDetail(
      word,
      makeProgress("w2", { status: "mastered", strength: 0.85 }),
      "zh",
    )

    expect(en.meaning).toBe("meaning w2")
    expect(en.definition).toBe("definition w2")
    expect(zh.meaning).toBe("意思 w2")
    expect(zh.definition).toBe("解释 w2")
    expect(en.example).toEqual(word.examples[0])
    expect(en.example.en).toBe("An example with w2.")
    expect(en.example.zh).toBe("一个包含 w2 的例句。")
  })

  it("passes through IPA, image, topics, and progress state", () => {
    const detail = buildWordDetail(
      word,
      makeProgress("w2", { status: "mastered", strength: 0.85 }),
      "en",
    )

    expect(detail.phonetic).toBe("/wɜːd/")
    expect(detail.image).toBe("w2.png")
    expect(detail.topicIds).toEqual([TOPIC_A, TOPIC_B])
    expect(detail.status).toBe("mastered")
    expect(detail.strength).toBe(0.85)
  })

  it("treats an uncounted word as new with no strength", () => {
    const detail = buildWordDetail(word, undefined, "en")

    expect(detail.status).toBe("new")
    expect(detail.strength).toBe(0)
  })
})
