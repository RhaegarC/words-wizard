import { describe, expect, it } from "vitest"

import { config } from "../config"
import { buildFreePractice, unlockedPacksFor } from "../freePractice"
import { sessionSeed } from "../session"
import type { IntroductionWrite } from "../provider"
import type { Pack, Progress, Word, WordLevel } from "../types"

const NOW = 1_000_000
const DAY = 86_400_000

function makeWord(
  id: string,
  topicId = "t1",
  level: WordLevel = 1,
): Word {
  return {
    id,
    text: id,
    phonetic: `/${id}/`,
    partOfSpeech: "noun",
    meaningEn: `meaning of ${id}`,
    meaningZh: `${id} 的意思`,
    definitionEn: `definition of ${id}`,
    definitionZh: `${id} 的解释`,
    examples: [{ en: `I see a ${id}.`, zh: `我看见一个${id}。` }],
    image: null,
    emoji: "🔤",
    level,
    tags: [],
    topicIds: [topicId],
  }
}

function makePack(
  id: string,
  wordIds: string[],
  order: number,
  topicId = "t1",
): Pack {
  return {
    id,
    title: id,
    titleZh: id,
    topicId,
    wordIds,
    order,
  }
}

function makeProgress(wordId: string): Progress {
  return {
    profileId: "oid-1",
    wordId,
    status: "learning",
    strength: 0.4,
    nextReviewAt: NOW - DAY,
    correctCount: 1,
    wrongCount: 0,
    firstSeenAt: NOW - 2 * DAY,
    lastSeenAt: NOW - DAY,
    masteryXpAwarded: false,
  }
}

function introductions(
  packId: string,
  wordIds: readonly string[],
): IntroductionWrite[] {
  return wordIds.map((wordId) => ({ packId, wordId }))
}

const SEED = sessionSeed("oid-1", NOW, "free", "dev", "p1")

function build(
  overrides: Partial<Parameters<typeof buildFreePractice>[0]> = {},
) {
  return buildFreePractice({
    profile: { id: "oid-1", currentTopicId: "t1" },
    packs: [],
    words: [],
    progress: [],
    introductions: [],
    packId: "p1",
    seed: SEED,
    speechAvailable: true,
    ...overrides,
  })
}

describe("unlockedPacksFor", () => {
  it("returns only the first pack until the previous pack is fully introduced", () => {
    const packs = [
      makePack("p1", ["w1", "w2"], 1),
      makePack("p2", ["w3", "w4"], 2),
    ]

    expect(
      unlockedPacksFor("t1", packs, introductions("p1", ["w1"])).map(
        (pack) => pack.id,
      ),
    ).toEqual(["p1"])

    expect(
      unlockedPacksFor(
        "t1",
        packs,
        [...introductions("p1", ["w1", "w2"])],
      ).map((pack) => pack.id),
    ).toEqual(["p1", "p2"])
  })

  it("returns no packs for a profile without a topic", () => {
    expect(
      unlockedPacksFor(
        null,
        [makePack("p1", ["w1"], 1)],
        introductions("p1", ["w1"]),
      ),
    ).toEqual([])
  })
})

describe("buildFreePractice", () => {
  const words = ["w1", "w2", "w3"].map((id) => makeWord(id))
  const pack = makePack("p1", ["w1", "w2", "w3"], 1)
  const rows = ["w1", "w2", "w3"].map((id) => makeProgress(id))

  it("selects only introduced words, in pack order, as review entries", () => {
    const plan = build({
      packs: [pack],
      words,
      progress: rows,
      introductions: introductions("p1", ["w1", "w3"]),
    })

    expect(plan.words.map((word) => word.wordId)).toEqual(["w1", "w3"])
    expect(plan.words.every((word) => word.kind === "review")).toBe(true)
    expect(plan.introductions).toEqual([])
    expect(plan.caughtUp).toBe(false)
  })

  it("ignores introduced words that are not in the content bundle", () => {
    const plan = build({
      packs: [pack],
      words: words.slice(0, 2),
      progress: rows,
      introductions: introductions("p1", ["w1", "w2", "w3"]),
    })

    expect(plan.words.map((word) => word.wordId)).toEqual(["w1", "w2"])
  })

  it("ignores an introduced word with no progress row, so the commit adds none", () => {
    const plan = build({
      packs: [pack],
      words,
      progress: rows.slice(0, 2),
      introductions: introductions("p1", ["w1", "w2", "w3"]),
    })

    expect(plan.words.map((word) => word.wordId)).toEqual(["w1", "w2"])
  })

  it("refuses a locked pack", () => {
    const first = makePack("p1", ["w1"], 1)
    const second = makePack("p2", ["w2"], 2)

    const plan = build({
      packs: [first, second],
      words,
      progress: rows,
      introductions: introductions("p1", ["w1"]),
      packId: "p2",
    })

    expect(plan.words).toEqual([])
    expect(plan.caughtUp).toBe(true)
  })

  it("refuses a pack from another topic", () => {
    const foreign = makePack("other", ["w1"], 1, "t2")

    const plan = build({
      packs: [foreign],
      words,
      progress: rows,
      introductions: introductions("other", ["w1"]),
      packId: "other",
    })

    expect(plan.words).toEqual([])
  })

  it("caps a session at the configured limit", () => {
    const many = Array.from({ length: 45 }, (_, index) => `x${index}`)
    const manyWords = many.map((id) => makeWord(id))
    const manyRows = many.map((id) => makeProgress(id))
    const bigPack = makePack("p1", many, 1)

    const plan = build({
      packs: [bigPack],
      words: manyWords,
      progress: manyRows,
      introductions: introductions("p1", many),
    })

    expect(plan.words).toHaveLength(config.freePractice.cap)
    expect(config.freePractice.cap).toBe(40)
  })

  it("rotates the available modes and drops listen without a voice", () => {
    const five = ["a", "b", "c", "d", "e"]
    const fiveWords = five.map((id) => makeWord(id))
    const fiveRows = five.map((id) => makeProgress(id))
    const fivePack = makePack("p1", five, 1)
    const fiveIntroductions = introductions("p1", five)

    const withVoice = build({
      packs: [fivePack],
      words: fiveWords,
      progress: fiveRows,
      introductions: fiveIntroductions,
    })
    const withoutVoice = build({
      packs: [fivePack],
      words: fiveWords,
      progress: fiveRows,
      introductions: fiveIntroductions,
      speechAvailable: false,
    })

    expect(new Set(withVoice.words.map((word) => word.modes[0]))).toEqual(
      new Set([
        "pictureMatch",
        "wordToMeaning",
        "spellingBuilder",
        "fillBlank",
        "listenChoose",
      ]),
    )
    expect(new Set(withoutVoice.words.map((word) => word.modes[0]))).toEqual(
      new Set(["pictureMatch", "wordToMeaning", "spellingBuilder", "fillBlank"]),
    )
    expect(
      withoutVoice.words.some((word) => word.modes.includes("listenChoose")),
    ).toBe(false)
  })

  it("is deterministic for the same seed", () => {
    const input = {
      packs: [pack],
      words,
      progress: rows,
      introductions: introductions("p1", words.map((word) => word.id)),
    }

    expect(build(input)).toEqual(build(input))
  })

  it("is caught up when the pack has no introduced words", () => {
    const plan = build({
      packs: [pack],
      words,
      progress: rows,
      introductions: [],
    })

    expect(plan.words).toEqual([])
    expect(plan.caughtUp).toBe(true)
  })
})
