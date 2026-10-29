import { describe, expect, it } from "vitest"

import { PRACTICE_MODES, type Word } from "@shared/types"

import { extractBlank } from "./fillBlank"
import {
  MODULES,
  applyHint1,
  buildExercise,
  checkAnswer,
  type ChoiceExercise,
} from "./index"
import type { Exercise, ModeContext } from "./types"

function makeWord(
  id: string,
  overrides: Partial<Word> = {},
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
    image: `art/${id}.webp`,
    emoji: "🔤",
    level: 1,
    tags: [],
    topicIds: ["t1"],
    ...overrides,
  }
}

function context(
  word: Word,
  words: readonly Word[],
  overrides: Partial<ModeContext> = {},
): ModeContext {
  return {
    word,
    words,
    locale: "en",
    seed: `seed|${word.id}`,
    speechAvailable: true,
    hasArt: () => true,
    ...overrides,
  }
}

function asChoice(exercise: Exercise): ChoiceExercise {
  if (exercise.mode === "spellingBuilder") {
    throw new Error("expected a choice exercise")
  }

  return exercise
}

function wordSet(
  word: Word,
  count: number,
  overrides: (index: number) => Partial<Word> = () => ({}),
): Word[] {
  return [
    word,
    ...Array.from({ length: count }, (_, index) =>
      makeWord(`d${index + 1}`, overrides(index)),
    ),
  ]
}

describe("exercise registry", () => {
  it("registers a module for every practice mode", () => {
    expect(Object.keys(MODULES).sort()).toEqual([...PRACTICE_MODES].sort())

    for (const mode of PRACTICE_MODES) {
      expect(MODULES[mode].mode).toBe(mode)
    }
  })
})

describe("choice options", () => {
  const choiceModes = [
    "pictureMatch",
    "wordToMeaning",
    "fillBlank",
    "listenChoose",
  ] as const

  it("offers three or four unique options with the answer exactly once", () => {
    const target = makeWord("target")
    const words = wordSet(target, 6)

    for (const mode of choiceModes) {
      const exercise = asChoice(buildExercise(mode, context(target, words)))

      expect(exercise.options.length, mode).toBeGreaterThanOrEqual(3)
      expect(exercise.options.length, mode).toBeLessThanOrEqual(4)
      expect(
        exercise.options.filter((option) => option.id === exercise.answerId),
        mode,
      ).toHaveLength(1)
      expect(
        new Set(exercise.options.map((option) => option.id)).size,
        mode,
      ).toBe(exercise.options.length)
      expect(
        exercise.options.map((option) => option.wordId),
        mode,
      ).toContain(target.id)
    }
  })

  it("is deterministic for the same seed", () => {
    const target = makeWord("target")
    const words = wordSet(target, 6)

    expect(
      buildExercise("pictureMatch", context(target, words, { seed: "a" })),
    ).toEqual(
      buildExercise("pictureMatch", context(target, words, { seed: "a" })),
    )
  })

  it("can change the option order for a different seed", () => {
    const target = makeWord("target")
    const words = wordSet(target, 6)
    const orders = new Set(
      Array.from({ length: 10 }, (_, index) =>
        JSON.stringify(
          asChoice(
            buildExercise(
              "pictureMatch",
              context(target, words, { seed: `seed-${index}` }),
            ),
          ).options.map((option) => option.id),
        ),
      ),
    )

    expect(orders.size).toBeGreaterThan(1)
  })

  it("prefers same-level distractors before other levels", () => {
    const target = makeWord("target", { level: 1, topicIds: ["t1"] })
    const sameLevel = Array.from({ length: 5 }, (_, index) =>
      makeWord(`same${index}`, { level: 1, topicIds: ["t2"] }),
    )
    const otherLevel = Array.from({ length: 5 }, (_, index) =>
      makeWord(`other${index}`, { level: 2, topicIds: ["t1"] }),
    )
    const exercise = asChoice(
      buildExercise("pictureMatch", context(target, [
        target,
        ...sameLevel,
        ...otherLevel,
      ])),
    )
    const chosen = exercise.options
      .map((option) => option.wordId)
      .filter((wordId) => wordId !== target.id)
    const sameLevelIds = new Set(sameLevel.map((word) => word.id))

    expect(chosen.every((wordId) => sameLevelIds.has(wordId))).toBe(true)
  })

  it("prefers same-topic words over unrelated words", () => {
    const target = makeWord("target", { level: 1, topicIds: ["t1"] })
    const differentTopic = makeWord("same-level", {
      level: 1,
      topicIds: ["t9"],
    })
    const sameTopic = Array.from({ length: 5 }, (_, index) =>
      makeWord(`topic${index}`, { level: 2, topicIds: ["t1"] }),
    )
    const unrelated = Array.from({ length: 5 }, (_, index) =>
      makeWord(`other${index}`, { level: 2, topicIds: ["t8"] }),
    )
    const exercise = asChoice(
      buildExercise("pictureMatch", context(target, [
        target,
        differentTopic,
        ...sameTopic,
        ...unrelated,
      ])),
    )
    const chosen = exercise.options
      .map((option) => option.wordId)
      .filter((wordId) => wordId !== target.id)
    const allowed = new Set([
      differentTopic.id,
      ...sameTopic.map((word) => word.id),
    ])

    expect(chosen.every((wordId) => allowed.has(wordId))).toBe(true)
  })

  it("never offers two options with the same visible label", () => {
    const target = makeWord("target", { text: "target" })
    const words = [
      target,
      makeWord("twin-a", { text: "same" }),
      makeWord("twin-b", { text: "same" }),
      makeWord("unique-a", { text: "alpha" }),
      makeWord("unique-b", { text: "beta" }),
      makeWord("unique-c", { text: "gamma" }),
    ]
    const exercise = asChoice(buildExercise("pictureMatch", context(target, words)))
    const labels = exercise.options.map((option) => option.label?.toLowerCase())

    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe("picture match", () => {
  it("uses the target illustration and English word options", () => {
    const target = makeWord("bag", { text: "bag" })
    const exercise = buildExercise(
      "pictureMatch",
      context(target, wordSet(target, 5)),
    )

    expect(exercise.wordId).toBe(target.id)

    const choice = asChoice(exercise)

    expect(choice.options.map((option) => option.label)).toContain("bag")
    expect(checkAnswer("pictureMatch", exercise, {
      kind: "choice",
      optionId: choice.answerId,
    })).toBe(true)
    expect(
      checkAnswer("pictureMatch", exercise, {
        kind: "choice",
        optionId: choice.options.find(
          (option) => option.id !== choice.answerId,
        )!.id,
      }),
    ).toBe(false)
  })
})

describe("word to meaning", () => {
  const target = makeWord("bag", {
    text: "bag",
    meaningEn: "a thing you carry things in",
    meaningZh: "包；袋子",
  })
  const words = wordSet(target, 5)

  it("offers meanings in the active locale", () => {
    const english = asChoice(
      buildExercise("wordToMeaning", context(target, words, { locale: "en" })),
    )
    const chinese = asChoice(
      buildExercise("wordToMeaning", context(target, words, { locale: "zh" })),
    )

    expect(english.options.map((option) => option.label)).toContain(
      target.meaningEn,
    )
    expect(english.options.map((option) => option.label)).not.toContain(
      target.meaningZh,
    )
    expect(chinese.options.map((option) => option.label)).toContain(
      target.meaningZh,
    )
    expect(chinese.options.map((option) => option.label)).not.toContain(
      target.meaningEn,
    )
  })

  it("prompts with the English word", () => {
    expect(
      buildExercise("wordToMeaning", context(target, words)).wordId,
    ).toBe(target.id)
  })
})

describe("spelling builder", () => {
  it("offers every answer letter plus one to three distractors", () => {
    const target = makeWord("banana", { text: "banana" })
    const words = wordSet(target, 5)
    const counts = new Map<string, number>()

    for (let index = 0; index < 20; index += 1) {
      const exercise = buildExercise(
        "spellingBuilder",
        context(target, words, { seed: `s${index}` }),
      )

      if (exercise.mode !== "spellingBuilder") {
        throw new Error("expected spelling")
      }

      const extra = exercise.tiles.length - target.text.length

      expect(extra).toBeGreaterThanOrEqual(1)
      expect(extra).toBeLessThanOrEqual(3)
      counts.set(`${extra}`, (counts.get(`${extra}`) ?? 0) + 1)
    }

    expect(counts.size).toBeGreaterThan(1)
  })

  it("keeps duplicate letters as separate tiles", () => {
    const target = makeWord("ball", { text: "ball" })
    const exercise = buildExercise(
      "spellingBuilder",
      context(target, wordSet(target, 3)),
    )

    if (exercise.mode !== "spellingBuilder") {
      throw new Error("expected spelling")
    }

    expect(exercise.tiles.filter((tile) => tile.letter === "l")).toHaveLength(2)
    expect(new Set(exercise.tiles.map((tile) => tile.id)).size).toBe(
      exercise.tiles.length,
    )
  })

  it("checks the assembled letters, not the tile identity", () => {
    const target = makeWord("cat", { text: "cat" })
    const exercise = buildExercise(
      "spellingBuilder",
      context(target, wordSet(target, 3)),
    )

    expect(
      checkAnswer("spellingBuilder", exercise, {
        kind: "letters",
        letters: ["c", "a", "t"],
      }),
    ).toBe(true)
    expect(
      checkAnswer("spellingBuilder", exercise, {
        kind: "letters",
        letters: ["c", "a"],
      }),
    ).toBe(false)
    expect(
      checkAnswer("spellingBuilder", exercise, {
        kind: "letters",
        letters: ["t", "a", "c"],
      }),
    ).toBe(false)
  })

  it("is deterministic for the same seed", () => {
    const target = makeWord("cat", { text: "cat" })
    const words = wordSet(target, 3)

    expect(
      buildExercise("spellingBuilder", context(target, words, { seed: "x" })),
    ).toEqual(
      buildExercise("spellingBuilder", context(target, words, { seed: "x" })),
    )
  })
})

describe("fill the blank", () => {
  it("extracts the word on a boundary and preserves punctuation", () => {
    expect(extractBlank("I like art, a lot.", "art")).toEqual({
      before: "I like ",
      after: ", a lot.",
    })
    expect(extractBlank("Art is fun.", "art")).toEqual({
      before: "",
      after: " is fun.",
    })
  })

  it("does not match a word inside another word", () => {
    expect(extractBlank("We start now.", "art")).toBeNull()
  })

  it("rejects an example without the word at build time", () => {
    const target = makeWord("art", {
      text: "art",
      examples: [{ en: "We start now.", zh: "我们现在开始。" }],
    })

    expect(() =>
      buildExercise("fillBlank", context(target, wordSet(target, 5))),
    ).toThrow(/art/i)
  })

  it("shows the Chinese translation and English word options", () => {
    const target = makeWord("art", {
      text: "art",
      examples: [{ en: "I like art, a lot.", zh: "我很喜欢艺术。" }],
    })
    const exercise = asChoice(
      buildExercise("fillBlank", context(target, wordSet(target, 5))),
    )

    expect(exercise.mode).toBe("fillBlank")

    if (exercise.mode !== "fillBlank") {
      throw new Error("expected fill the blank")
    }

    expect(exercise.before).toBe("I like ")
    expect(exercise.after).toBe(", a lot.")
    expect(exercise.translationZh).toBe("我很喜欢艺术。")
    expect(exercise.options.map((option) => option.label)).toContain("art")
  })
})

describe("listen and choose", () => {
  const target = makeWord("bag", { text: "bag" })

  it("uses picture options when approved art exists", () => {
    const exercise = asChoice(
      buildExercise("listenChoose", context(target, wordSet(target, 5))),
    )

    expect(exercise.mode).toBe("listenChoose")

    if (exercise.mode !== "listenChoose") {
      throw new Error("expected listen and choose")
    }

    expect(exercise.presentation).toBe("picture")

    for (const option of exercise.options) {
      expect("label" in option).toBe(false)
    }
  })

  it("falls back to word options when art is unavailable", () => {
    const exercise = asChoice(
      buildExercise(
        "listenChoose",
        context(target, wordSet(target, 5), {
          hasArt: (word) => word.id !== target.id,
        }),
      ),
    )

    if (exercise.mode !== "listenChoose") {
      throw new Error("expected listen and choose")
    }

    expect(exercise.presentation).toBe("word")

    for (const option of exercise.options) {
      expect(typeof option.label).toBe("string")
    }
  })
})

describe("hint level 1", () => {
  it("removes exactly one distractor for every choice mode", () => {
    const target = makeWord("target")
    const words = wordSet(target, 6)

    for (const mode of [
      "pictureMatch",
      "wordToMeaning",
      "listenChoose",
    ] as const) {
      const exercise = asChoice(buildExercise(mode, context(target, words)))
      const hinted = asChoice(applyHint1(mode, exercise))

      expect(hinted.options, mode).toHaveLength(exercise.options.length - 1)
      expect(
        hinted.options.some((option) => option.id === exercise.answerId),
        mode,
      ).toBe(true)
    }
  })

  it("keeps the option the child chose when a distractor is removed", () => {
    const target = makeWord("target")
    const words = wordSet(target, 6)
    const exercise = asChoice(
      buildExercise("wordToMeaning", context(target, words)),
    )
    const selected = exercise.options.find(
      (option) => option.id !== exercise.answerId,
    )

    if (!selected) {
      throw new Error("expected a distractor")
    }

    const withoutChoice = asChoice(applyHint1("wordToMeaning", exercise))

    expect(
      withoutChoice.options.some((option) => option.id === selected.id),
    ).toBe(false)

    const hinted = asChoice(
      applyHint1("wordToMeaning", exercise, selected.id),
    )

    expect(hinted.options).toHaveLength(exercise.options.length - 1)
    expect(hinted.options.some((option) => option.id === selected.id)).toBe(
      true,
    )
    expect(
      hinted.options.some((option) => option.id === exercise.answerId),
    ).toBe(true)
  })

  it("reveals only the first letter for spelling", () => {
    const target = makeWord("bag", { text: "bag" })
    const exercise = buildExercise(
      "spellingBuilder",
      context(target, wordSet(target, 4)),
    )

    if (exercise.mode !== "spellingBuilder") {
      throw new Error("expected spelling")
    }

    expect(exercise.firstLetter).toBeNull()

    const hinted = applyHint1("spellingBuilder", exercise)

    if (hinted.mode !== "spellingBuilder") {
      throw new Error("expected spelling")
    }

    expect(hinted.firstLetter).toBe("b")
    expect(hinted.answer).toBe("bag")
    expect(hinted.tiles).toEqual(exercise.tiles)
  })

  it("reveals only the first letter for fill the blank", () => {
    const target = makeWord("art", {
      text: "art",
      examples: [{ en: "I like art, a lot.", zh: "我很喜欢艺术。" }],
    })
    const exercise = buildExercise(
      "fillBlank",
      context(target, wordSet(target, 5)),
    )

    if (exercise.mode !== "fillBlank") {
      throw new Error("expected fill the blank")
    }

    const hinted = applyHint1("fillBlank", exercise)

    if (hinted.mode !== "fillBlank") {
      throw new Error("expected fill the blank")
    }

    expect(hinted.firstLetter).toBe("a")
    expect(hinted.options).toEqual(exercise.options)
    expect(hinted.before).toBe(exercise.before)
  })

  it("does nothing when only the answer remains", () => {
    const target = makeWord("target")
    const exercise = asChoice(
      buildExercise("pictureMatch", context(target, [target])),
    )
    const hinted = asChoice(applyHint1("pictureMatch", exercise))

    expect(hinted.options).toEqual(exercise.options)
  })
})

describe("mode purity", () => {
  it("never mutates the content it is given", () => {
    const target = makeWord("bag", { text: "bag" })
    const words = wordSet(target, 5)
    const before = JSON.stringify(words)

    buildExercise("spellingBuilder", context(target, words))

    expect(JSON.stringify(words)).toBe(before)
  })
})
