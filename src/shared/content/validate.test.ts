import { describe, expect, it } from "vitest"

import {
  STAGE_IDS,
  type Pack,
  type StageId,
  type Topic,
  type Word,
  type WordLevel,
} from "../types"
import type { Avatar, ContentBundle } from "./types"
import { hasErrors, validateContent } from "./validate"

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
      { en: `I see a ${text} here.`, zh: `我在这里看到一个${text}。` },
      { en: `We say ${text} again.`, zh: `我们再说一次${text}。` },
    ],
    image: `https://images.example.test/${id}.webp`,
    emoji: "🅰️",
    level: 1,
    tags: ["abstract"],
    topicIds: ["topic-a"],
    ...overrides,
  }
}

/**
 * Two topics, three packs, one word shared between topics — deliberately not
 * the old five-topics/three-packs/twenty-slots shape: the validator no longer
 * knows or cares about counts.
 */
function makeBundle(dataset: "dev" | "final" = "dev"): ContentBundle {
  const words = WORD_IDS.map((id) => makeWord(id))
  words[0].topicIds = ["topic-a", "topic-b"]

  const topics: Topic[] = [
    {
      id: "topic-a",
      title: "Topic A",
      titleZh: "主题 A",
      icon: "🔨",
      description: "Things to make.",
      descriptionZh: "做东西。",
      sortOrder: 1,
    },
    {
      id: "topic-b",
      title: "Topic B",
      titleZh: "主题 B",
      icon: "🌿",
      description: "Things outside.",
      descriptionZh: "外面的东西。",
      sortOrder: 2,
    },
  ]

  const packs: Pack[] = [
    {
      id: "a-1",
      title: "First A",
      titleZh: "第一包 A",
      topicId: "topic-a",
      order: 1,
      wordIds: ["w-alpha", "w-beta"],
    },
    {
      id: "a-2",
      title: "Second A",
      titleZh: "第二包 A",
      topicId: "topic-a",
      order: 2,
      wordIds: ["w-gamma"],
    },
    {
      id: "b-1",
      title: "First B",
      titleZh: "第一包 B",
      topicId: "topic-b",
      order: 1,
      wordIds: ["w-alpha", "w-delta", "w-epsilon"],
    },
  ]

  return {
    meta: { schemaVersion: 1, dataset, contentVersion: "1.0.0" },
    topics,
    packs,
    words,
    avatars: makeAvatars(),
  }
}

function makeAvatars(): Avatar[] {
  return [
    "alex",
    "cody",
    "creeper",
    "malenia",
    "may",
    "radahn",
    "steve",
    "warden",
  ].map((id) => ({
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

function codes(bundle: ContentBundle): string[] {
  return validateContent(bundle, { forbiddenTerms: ["minecraft"] }).map(
    (issue) => issue.code,
  )
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
    expect(validateContent(makeBundle(), { forbiddenTerms: ["minecraft"] })).toEqual([])
  })

  it("accepts a valid final bundle", () => {
    expect(codes(makeBundle("final"))).toEqual([])
  })

  it("accepts a single topic with a single pack and word — no fixed counts", () => {
    const bundle = makeBundle()
    bundle.topics = [bundle.topics[0]]
    bundle.packs = [pack(bundle, "a-1")]
    bundle.words = [bundle.words[0], bundle.words[1]]
    bundle.words[0].topicIds = ["topic-a"]
    bundle.words[1].topicIds = ["topic-a"]

    expect(codes(bundle)).toEqual([])
  })

  it("rejects duplicate ids", () => {
    const bundle = makeBundle()
    bundle.topics.push({ ...bundle.topics[0] })

    expect(codes(bundle)).toEqual(["duplicate-id"])
  })

  it("rejects a headword repeated case-insensitively", () => {
    const bundle = makeBundle()
    bundle.words[1].text = "ALPHA"
    bundle.words[1].examples[0].en = "I see ALPHA here."

    expect(codes(bundle)).toEqual(["word-text-duplicate"])
  })

  it("reports an unknown pack word as an error, even in dev", () => {
    const bundle = makeBundle()
    pack(bundle, "a-1").wordIds[0] = "w-missing"

    const issues = validateContent(bundle, { forbiddenTerms: [] })

    expect(issues.map((issue) => issue.code)).toEqual(["pack-word-ref"])
    expect(issues[0].severity).toBe("error")
    expect(issues[0].id).toBe("w-missing")
    expect(issues[0].message).toContain("a-1")
  })

  it("rejects a pack that names an unknown topic", () => {
    const bundle = makeBundle()
    bundle.packs[0].topicId = "topic-missing"

    expect(codes(bundle)).toEqual(["pack-topic-ref"])
  })

  it("rejects a pack that lists the same word twice", () => {
    const bundle = makeBundle()
    pack(bundle, "a-1").wordIds = ["w-alpha", "w-alpha"]

    expect(codes(bundle)).toEqual(["pack-duplicate-word"])
  })

  it("rejects a topic with no pack", () => {
    const bundle = makeBundle()
    bundle.packs = bundle.packs.filter((candidate) => candidate.id !== "b-1")
    bundle.words[0].topicIds = ["topic-a"]

    expect(codes(bundle)).toEqual(["topic-no-packs"])
  })

  it("rejects a pack with no word", () => {
    const bundle = makeBundle()
    pack(bundle, "a-2").wordIds = []

    expect(codes(bundle)).toEqual(["pack-no-words"])
  })

  it("rejects a served word with no topic", () => {
    const bundle = makeBundle()
    bundle.words[4].topicIds = []

    expect(codes(bundle)).toEqual(["word-no-topic"])
  })

  it("rejects a word that names an unknown topic", () => {
    const bundle = makeBundle()
    bundle.words[1].topicIds = ["topic-missing"]

    expect(codes(bundle)).toEqual(["word-topic-ref"])
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

  it("rejects a word with no examples", () => {
    const bundle = makeBundle()
    bundle.words[0].examples = []

    expect(codes(bundle)).toEqual(["word-no-examples"])
  })

  it("accepts a null image and rejects a relative one", () => {
    const bundle = makeBundle()
    bundle.words[0].image = null

    expect(codes(bundle)).toEqual([])

    bundle.words[0].image = "art/w-alpha.webp"

    expect(codes(bundle)).toEqual(["image-url"])
  })

  it("warns about a first example that omits the word in dev, and errors in final", () => {
    const bundle = makeBundle()
    bundle.words[0].examples[0].en = "Something else entirely."

    const dev = validateContent(bundle, { forbiddenTerms: [] })
    expect(dev.map((issue) => issue.code)).toEqual(["example-missing-word"])
    expect(dev[0].severity).toBe("warning")

    bundle.meta.dataset = "final"

    const final = validateContent(bundle, { forbiddenTerms: [] })
    expect(final.map((issue) => issue.code)).toEqual(["example-missing-word"])
    expect(final[0].severity).toBe("error")
    expect(hasErrors(final)).toBe(true)
  })

  it("warns about a forbidden term in dev and errors in final", () => {
    const bundle = makeBundle()
    pack(bundle, "a-1").title = "Minecraft Builders"

    const dev = validateContent(bundle, { forbiddenTerms: ["minecraft"] })
    expect(dev.map((issue) => issue.code)).toEqual(["forbidden-term"])
    expect(dev[0].severity).toBe("warning")

    bundle.meta.dataset = "final"

    const final = validateContent(bundle, { forbiddenTerms: ["minecraft"] })
    expect(final.map((issue) => issue.code)).toEqual(["forbidden-term"])
    expect(final[0].severity).toBe("error")
  })

  it("checks the Cambridge allowlist only when one is supplied", () => {
    const bundle = makeBundle()
    const allowlist = WORD_IDS.map((id) => id.slice(2)).filter(
      (text) => text !== "epsilon",
    )

    const without = validateContent(bundle, { forbiddenTerms: [] })
    expect(without.map((issue) => issue.code)).not.toContain(
      "word-not-in-allowlist",
    )

    const dev = validateContent(bundle, { forbiddenTerms: [], allowlist })
    expect(dev.map((issue) => issue.code)).toEqual(["word-not-in-allowlist"])
    expect(dev[0].severity).toBe("warning")
    expect(dev[0].id).toBe("w-epsilon")

    bundle.meta.dataset = "final"

    const final = validateContent(bundle, { forbiddenTerms: [], allowlist })
    expect(final[0].severity).toBe("error")
  })

  it("requires an abstract word in every topic and in each pack's final third", () => {
    const bundle = makeBundle()

    for (const word of bundle.words) {
      word.tags = []
    }

    const dev = validateContent(bundle, { forbiddenTerms: [] })

    // Two topics plus three packs.
    expect(dev).toHaveLength(5)
    expect(dev.every((issue) => issue.code === "abstract-word-missing")).toBe(true)
    expect(dev.every((issue) => issue.severity === "warning")).toBe(true)

    bundle.meta.dataset = "final"

    const final = validateContent(bundle, { forbiddenTerms: [] })
    expect(final.every((issue) => issue.severity === "error")).toBe(true)
  })

  it("requires eight avatars", () => {
    const bundle = makeBundle()
    bundle.avatars.pop()

    expect(codes(bundle)).toEqual(["avatar-count"])
  })

  it("requires every avatar stage", () => {
    const bundle = makeBundle()
    const stages = bundle.avatars[0].stages as Partial<
      Record<StageId, string>
    >
    delete stages.egg

    expect(codes(bundle)).toEqual(["avatar-stage-missing"])
  })
})
