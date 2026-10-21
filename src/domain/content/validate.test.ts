import { describe, expect, it } from "vitest"

import {
  STAGE_IDS,
  type Pack,
  type StageId,
  type Topic,
  type Word,
  type WordLevel,
} from "../types"
import type { ArtworkManifest, Avatar, ContentBundle } from "./types"
import { hasErrors, validateContent } from "./validate"

const TOPIC_IDS = ["topic-1", "topic-2", "topic-3", "topic-4", "topic-5"]
const WORD_IDS = ["w-alpha", "w-beta", "w-gamma", "w-delta", "w-epsilon"]

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function makeWord(id: string, overrides: Partial<Word> = {}): Word {
  const text = id.slice(2)

  return {
    id,
    text,
    phonetic: `/${text}/`,
    partOfSpeech: "noun",
    meaningEn: `the ${text}`,
    meaningZh: `含义 ${text}`,
    definitionEn: `${capitalise(text)} is a word.`,
    definitionZh: `${text} 是一个词。`,
    examples: [
      { en: `${capitalise(text)} is here.`, zh: `${text} 在这里。` },
      { en: `We say ${text} again.`, zh: `我们再说一次 ${text}。` },
    ],
    image: `art/${id}.webp`,
    emoji: "🅰️",
    level: 1,
    tags: ["abstract"],
    topicIds: [...TOPIC_IDS],
    ...overrides,
  }
}

function makeTopics(): Topic[] {
  return TOPIC_IDS.map((id, index) => ({
    id,
    title: `Topic ${index + 1}`,
    titleZh: `主题 ${index + 1}`,
    icon: "🔨",
    description: "Things to make.",
    descriptionZh: "做东西。",
    packIds: [1, 2, 3].map((order) => `${id}-${order}`),
  }))
}

function makePacks(): Pack[] {
  return TOPIC_IDS.flatMap((topicId) =>
    [1, 2, 3].map((order) => ({
      id: `${topicId}-${order}`,
      title: `Pack ${order}`,
      titleZh: `包 ${order}`,
      topicId,
      order,
      unlockRule: {
        type: "masteryCount" as const,
        value: (order === 1 ? 0 : order === 2 ? 15 : 30) as 0 | 15 | 30,
      },
      wordIds: Array.from(
        { length: 20 },
        (_, index) => WORD_IDS[index % WORD_IDS.length],
      ),
    })),
  )
}

function makeAvatars(): Avatar[] {
  return ["luma", "pippin", "moss"].map((id) => ({
    id,
    name: capitalise(id),
    nameZh: id,
    color: "#7562df",
    pale: "#ded9ff",
    stages: Object.fromEntries(
      STAGE_IDS.map((stage) => [stage, `art/avatars/${id}-${stage}.webp`]),
    ) as Record<StageId, string>,
  }))
}

function makeBundle(): ContentBundle {
  const words = WORD_IDS.map((id) => makeWord(id))
  const artwork: ArtworkManifest = {}

  for (const word of words) {
    artwork[word.id] = { file: word.image, status: "approved" }
  }

  return {
    meta: { schemaVersion: 1, dataset: "dev", contentVersion: "1.0.0" },
    topics: makeTopics(),
    packs: makePacks(),
    words,
    avatars: makeAvatars(),
    artwork,
  }
}

function codes(bundle: ContentBundle): string[] {
  return validateContent(bundle, {
    forbiddenTerms: ["minecraft"],
    artExists: () => true,
  }).map((issue) => issue.code)
}

function pack(bundle: ContentBundle, id: string): Pack {
  const found = bundle.packs.find((candidate) => candidate.id === id)

  if (!found) {
    throw new Error(`Fixture is missing pack ${id}`)
  }

  return found
}

describe("validateContent", () => {
  it("accepts a valid dev bundle", () => {
    expect(validateContent(makeBundle(), {
      forbiddenTerms: ["minecraft"],
      artExists: () => true,
    })).toEqual([])
  })

  it("accepts a valid final bundle", () => {
    const bundle = makeBundle()
    bundle.meta.dataset = "final"

    expect(codes(bundle)).toEqual([])
  })

  it("requires exactly five topics", () => {
    const bundle = makeBundle()
    bundle.topics = bundle.topics.filter((topic) => topic.id !== "topic-5")
    bundle.packs = bundle.packs.filter((candidate) => candidate.topicId !== "topic-5")

    for (const word of bundle.words) {
      word.topicIds = word.topicIds.filter((id) => id !== "topic-5")
    }

    expect(codes(bundle)).toEqual(["topic-count"])
  })

  it("requires three packs per topic", () => {
    const bundle = makeBundle()
    const topic = bundle.topics[0]
    topic.packIds = topic.packIds.filter((id) => id !== "topic-1-1")
    bundle.packs = bundle.packs.filter((candidate) => candidate.id !== "topic-1-1")

    expect(codes(bundle)).toEqual(["pack-count"])
  })

  it("requires twenty slots per pack", () => {
    const bundle = makeBundle()
    pack(bundle, "topic-1-1").wordIds = pack(bundle, "topic-1-1").wordIds.slice(1)

    expect(codes(bundle)).toEqual(["pack-slots"])
  })

  it("rejects duplicate ids", () => {
    const bundle = makeBundle()
    bundle.words.push({ ...bundle.words[0] })

    expect(codes(bundle)).toEqual(["duplicate-id"])
  })

  it("reports an unresolved pack slot as a warning in dev", () => {
    const bundle = makeBundle()
    pack(bundle, "topic-1-1").wordIds[0] = "w-missing"

    const issues = validateContent(bundle, {
      forbiddenTerms: [],
      artExists: () => true,
    })

    expect(issues.map((issue) => issue.code)).toEqual(["pack-word-ref"])
    expect(issues[0].severity).toBe("warning")
    expect(issues[0].id).toBe("w-missing")
    expect(issues[0].message).toContain("topic-1-1")
  })

  it("reports an unresolved pack slot as an error in final", () => {
    const bundle = makeBundle()
    bundle.meta.dataset = "final"
    pack(bundle, "topic-1-1").wordIds[0] = "w-missing"

    const issues = validateContent(bundle, {
      forbiddenTerms: [],
      artExists: () => true,
    })

    expect(issues.map((issue) => issue.code)).toEqual(["pack-word-ref"])
    expect(issues[0].severity).toBe("error")
    expect(hasErrors(issues)).toBe(true)
  })

  it("rejects a level outside 1, 2, or 3", () => {
    const bundle = makeBundle()
    bundle.words[0].level = 4 as WordLevel

    expect(codes(bundle)).toEqual(["bad-level"])
  })

  it("rejects an empty bilingual field", () => {
    const bundle = makeBundle()
    bundle.words[0].meaningZh = " "

    expect(codes(bundle)).toEqual(["word-empty-field"])
  })

  it("rejects an example with only one language", () => {
    const bundle = makeBundle()
    bundle.words[0].examples[0].zh = ""

    expect(codes(bundle)).toEqual(["example-unpaired"])
  })

  it("rejects a first example that omits the target word", () => {
    const bundle = makeBundle()
    bundle.words[0].examples[0].en = "Something else entirely."

    expect(codes(bundle)).toEqual(["example-missing-word"])
  })

  it("rejects a word with no examples", () => {
    const bundle = makeBundle()
    bundle.words[0].examples = []

    expect(codes(bundle)).toEqual(["word-no-examples"])
  })

  it("requires a manifest entry for every word", () => {
    const bundle = makeBundle()
    delete bundle.artwork["w-alpha"]

    expect(codes(bundle)).toEqual(["art-manifest-missing"])
  })

  it("reports a missing artwork file as a warning in dev", () => {
    const bundle = makeBundle()
    const issues = validateContent(bundle, {
      forbiddenTerms: [],
      artExists: (file) => file !== "art/w-alpha.webp",
    })

    expect(issues.map((issue) => issue.code)).toEqual(["art-missing"])
    expect(issues[0].severity).toBe("warning")
  })

  it("reports a missing artwork file as an error in final", () => {
    const bundle = makeBundle()
    bundle.meta.dataset = "final"
    const issues = validateContent(bundle, {
      forbiddenTerms: [],
      artExists: (file) => file !== "art/w-alpha.webp",
    })

    expect(issues.map((issue) => issue.code)).toEqual(["art-missing"])
    expect(issues[0].severity).toBe("error")
  })

  it("reports placeholder art as a warning in dev and an error in final", () => {
    const bundle = makeBundle()
    bundle.artwork["w-alpha"].status = "placeholder"

    const dev = validateContent(bundle, {
      forbiddenTerms: [],
      artExists: () => true,
    })

    expect(dev.map((issue) => issue.code)).toEqual(["art-placeholder"])
    expect(dev[0].severity).toBe("warning")

    bundle.meta.dataset = "final"

    const final = validateContent(bundle, {
      forbiddenTerms: [],
      artExists: () => true,
    })

    expect(final.map((issue) => issue.code)).toEqual(["art-placeholder"])
    expect(final[0].severity).toBe("error")
  })

  it("rejects a forbidden term in any authored field", () => {
    const bundle = makeBundle()
    pack(bundle, "topic-1-1").title = "Minecraft Builders"

    expect(codes(bundle)).toEqual(["forbidden-term"])
  })

  it("rejects an unlock value outside 0, 15, and 30", () => {
    const bundle = makeBundle()
    pack(bundle, "topic-1-2").unlockRule = {
      type: "masteryCount",
      value: 10 as 0 | 15 | 30,
    }

    expect(codes(bundle)).toEqual(["bad-unlock"])
  })

  it("requires pack order 1..3 to be unique within a topic", () => {
    const bundle = makeBundle()
    pack(bundle, "topic-1-2").order = 1

    expect(codes(bundle)).toEqual(["pack-order"])
  })

  it("rejects more than 300 distinct words in final", () => {
    const bundle = makeBundle()
    bundle.meta.dataset = "final"

    const words = Array.from({ length: 301 }, (_, index) => {
      const text = `word${index + 1}`

      return makeWord("w-alpha", {
        id: `w-${text}`,
        text,
        image: `art/w-${text}.webp`,
        examples: [{ en: `${text} is here.`, zh: `${text} 在这里。` }],
      })
    })

    bundle.words = words
    bundle.artwork = {}

    for (const word of words) {
      bundle.artwork[word.id] = { file: word.image, status: "approved" }
    }

    for (const candidate of bundle.packs) {
      candidate.wordIds = Array.from(
        { length: 20 },
        (_, index) => words[index % 300].id,
      )
    }

    expect(codes(bundle)).toEqual(["final-distinct-words"])
  })

  it("requires an abstract word in every topic and in each pack's final third", () => {
    const bundle = makeBundle()

    for (const word of bundle.words) {
      word.tags = []
    }

    const issues = validateContent(bundle, {
      forbiddenTerms: [],
      artExists: () => true,
    })

    expect(issues).toHaveLength(20)
    expect(issues.every((issue) => issue.code === "abstract-word-missing")).toBe(
      true,
    )
  })

  it("requires three avatars", () => {
    const bundle = makeBundle()
    bundle.avatars.pop()

    expect(codes(bundle)).toEqual(["avatar-count"])
  })

  it("requires every avatar stage", () => {
    const bundle = makeBundle()
    const { egg: _egg, ...stages } = bundle.avatars[0].stages
    bundle.avatars[0].stages = stages as Record<StageId, string>

    expect(codes(bundle)).toEqual(["avatar-stage-missing"])
  })
})
