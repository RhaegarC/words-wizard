import { describe, expect, it } from "vitest"

import {
  buildExamParts,
  firstMissedWord,
  normalizeSpelling,
  parseExamSubmission,
} from "../exam"

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `w${index + 1}`)
}

describe("buildExamParts", () => {
  it("returns no parts for an empty word list", () => {
    expect(buildExamParts([])).toEqual([])
  })

  it("keeps every part strictly under 50 words", () => {
    for (const count of [1, 49, 50, 60, 100, 149, 150]) {
      const parts = buildExamParts(ids(count))

      expect(parts.every((part) => part.wordIds.length < 50)).toBe(true)
      expect(parts.flatMap((part) => part.wordIds)).toHaveLength(count)
    }
  })

  it("balances the parts and keeps their order", () => {
    expect(buildExamParts(ids(60)).map((part) => part.wordIds.length)).toEqual([
      30, 30,
    ])
    expect(
      buildExamParts(ids(100)).map((part) => part.wordIds.length),
    ).toEqual([34, 33, 33])
    expect(buildExamParts(ids(50)).map((part) => part.wordIds.length)).toEqual([
      25, 25,
    ])
    expect(buildExamParts(ids(49)).map((part) => part.wordIds.length)).toEqual([
      49,
    ])
  })

  it("numbers parts from zero and deduplicates ids at first occurrence", () => {
    const parts = buildExamParts(["a", "b", "a", "c", "b"])

    expect(parts).toEqual([{ index: 0, wordIds: ["a", "b", "c"] }])
  })
})

describe("normalizeSpelling", () => {
  it("trims, case-folds and collapses internal whitespace", () => {
    expect(normalizeSpelling("  Ham  Mer \n")).toBe("ham mer")
    expect(normalizeSpelling("HAMMER")).toBe("hammer")
    expect(normalizeSpelling("ham\tmer")).toBe("ham mer")
  })

  it("does not change the letters themselves", () => {
    expect(normalizeSpelling("café")).toBe("café")
    expect(normalizeSpelling("ice-cream")).toBe("ice-cream")
  })
})

describe("firstMissedWord", () => {
  const spellings = new Map([
    ["w1", "one"],
    ["w2", "two"],
    ["w3", "three"],
  ])

  it("returns the first mismatched word in part order", () => {
    expect(
      firstMissedWord(
        ["w1", "w2", "w3"],
        [
          { wordId: "w1", answer: "one" },
          { wordId: "w2", answer: "tow" },
          { wordId: "w3", answer: "three" },
        ],
        spellings,
      ),
    ).toBe("w2")
  })

  it("accepts normalized answers and returns null when all match", () => {
    expect(
      firstMissedWord(
        ["w1", "w2", "w3"],
        [
          { wordId: "w1", answer: " ONE " },
          { wordId: "w2", answer: "Two" },
          { wordId: "w3", answer: "three" },
        ],
        spellings,
      ),
    ).toBeNull()
  })
})

describe("parseExamSubmission", () => {
  const answers = [{ wordId: "w1", answer: "one" }]
  const valid = {
    topicId: "craft",
    partIndex: 0,
    attemptId: "attempt-1",
    contentVersion: "2026-11-19.1",
    answers,
  }

  it("accepts an answers submission", () => {
    expect(parseExamSubmission(valid)).toEqual({ ok: true, value: valid })
  })

  it("accepts a missed-word submission", () => {
    const value = {
      topicId: "craft",
      partIndex: 0,
      attemptId: "attempt-1",
      contentVersion: "2026-11-19.1",
      missedWordId: "w1",
    }

    expect(parseExamSubmission(value)).toEqual({ ok: true, value })
  })

  it("refuses a non-object or missing fields", () => {
    for (const value of [null, "body", 42, []]) {
      expect(parseExamSubmission(value)).toMatchObject({ ok: false })
    }

    expect(
      parseExamSubmission({ ...valid, topicId: undefined }),
    ).toMatchObject({ ok: false })
    expect(
      parseExamSubmission({ ...valid, partIndex: -1 }),
    ).toMatchObject({ ok: false })
    expect(
      parseExamSubmission({ ...valid, attemptId: "" }),
    ).toMatchObject({ ok: false })
    expect(
      parseExamSubmission({ ...valid, contentVersion: " " }),
    ).toMatchObject({ ok: false })
  })

  it("refuses both or neither of answers and missedWordId", () => {
    expect(
      parseExamSubmission({ ...valid, missedWordId: "w1" }),
    ).toMatchObject({ ok: false })
    expect(
      parseExamSubmission({
        topicId: "craft",
        partIndex: 0,
        attemptId: "attempt-1",
        contentVersion: "v",
      }),
    ).toMatchObject({ ok: false })
  })

  it("refuses more than 49 answers, duplicate ids, or blank answers", () => {
    expect(
      parseExamSubmission({
        ...valid,
        answers: ids(50).map((wordId) => ({ wordId, answer: wordId })),
      }),
    ).toMatchObject({ ok: false })
    expect(
      parseExamSubmission({
        ...valid,
        answers: [
          { wordId: "w1", answer: "one" },
          { wordId: "w1", answer: "one" },
        ],
      }),
    ).toMatchObject({ ok: false })
    expect(
      parseExamSubmission({
        ...valid,
        answers: [{ wordId: "w1", answer: "  " }],
      }),
    ).toMatchObject({ ok: false })
  })
})
