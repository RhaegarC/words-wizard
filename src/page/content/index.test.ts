import { beforeEach, describe, expect, it } from "vitest"

import type { Avatar, ContentBundle } from "@shared/content/types"
import type { Pack, Topic, Word } from "@shared/types"

import {
  clearContent,
  getAllPacks,
  getAllWords,
  getAvatarSet,
  getContentMeta,
  getHomeContent,
  getPack,
  getPacksByTopic,
  getTopic,
  getTopics,
  getWord,
  getWordsByIds,
  getWordsByTopic,
  loadContent,
} from "./index"

function makeTopic(id: string, sortOrder: number): Topic {
  return {
    id,
    title: id,
    titleZh: id,
    icon: "🔤",
    description: `${id} description`,
    descriptionZh: `${id} 描述`,
    sortOrder,
  }
}

function makePack(
  id: string,
  topicId: string,
  order: number,
  wordIds: string[],
): Pack {
  return { id, title: id, titleZh: id, topicId, order, wordIds }
}

function makeWord(id: string, topicIds: string[]): Word {
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
    level: 1,
    tags: [],
    topicIds,
  }
}

function makeAvatar(id: string): Avatar {
  return {
    id,
    name: id,
    nameZh: id,
    color: "#000000",
    pale: "#ffffff",
    stages: {
      egg: `${id}-egg.webp`,
      hatchling: `${id}-hatchling.webp`,
      juvenile: `${id}-juvenile.webp`,
      adult: `${id}-adult.webp`,
      legendary: `${id}-legendary.webp`,
    },
  }
}

const BUNDLE: ContentBundle = {
  meta: { schemaVersion: 1, dataset: "dev", contentVersion: "0.3.0" },
  topics: [makeTopic("t1", 1), makeTopic("t2", 2)],
  // Deliberately out of order: the loader sorts by `order`.
  packs: [
    makePack("t1-b", "t1", 2, ["w-c"]),
    makePack("t1-a", "t1", 1, ["w-a", "w-b"]),
    makePack("t2-a", "t2", 1, ["w-c"]),
  ],
  words: [
    makeWord("w-a", ["t1"]),
    makeWord("w-b", ["t1"]),
    makeWord("w-c", ["t1", "t2"]),
  ],
  avatars: [makeAvatar("luma")],
}

beforeEach(() => {
  clearContent()
})

describe("content before boot", () => {
  it("answers every accessor emptily rather than throwing", () => {
    expect(getTopics()).toEqual([])
    expect(getTopic("t1")).toBeUndefined()
    expect(getPacksByTopic("t1")).toEqual([])
    expect(getPack("t1-a")).toBeUndefined()
    expect(getWord("w-a")).toBeUndefined()
    expect(getWordsByIds(["w-a"])).toEqual([])
    expect(getWordsByTopic("t1")).toEqual([])
    expect(getAllWords()).toEqual([])
    expect(getAllPacks()).toEqual([])
    expect(getAvatarSet()).toEqual([])
  })

  it("reports an empty content version, not a missing bundle", () => {
    expect(getContentMeta()).toEqual({
      schemaVersion: 1,
      dataset: "dev",
      contentVersion: "",
    })
    expect(getHomeContent().contentVersion).toBe("")
  })
})

describe("loadContent", () => {
  it("replaces the bundle and exposes its metadata", () => {
    loadContent(BUNDLE)

    expect(getContentMeta()).toEqual(BUNDLE.meta)
    expect(getHomeContent().contentVersion).toBe("0.3.0")
  })

  it("lists topics in their served order", () => {
    loadContent(BUNDLE)

    expect(getTopics().map((topic) => topic.id)).toEqual(["t1", "t2"])
    expect(getTopic("t2")?.title).toBe("t2")
  })

  it("groups packs by topic, ascending by order", () => {
    loadContent(BUNDLE)

    expect(getPacksByTopic("t1").map((pack) => pack.id)).toEqual([
      "t1-a",
      "t1-b",
    ])
    expect(getPacksByTopic("nope")).toEqual([])
    expect(getPack("t1-b")?.wordIds).toEqual(["w-c"])
  })

  it("resolves ids in the requested order and skips unknown ones", () => {
    loadContent(BUNDLE)

    expect(getWordsByIds(["w-c", "nope", "w-a"]).map((word) => word.id)).toEqual(
      ["w-c", "w-a"],
    )
  })

  it("groups words by every topic they belong to", () => {
    loadContent(BUNDLE)

    expect(getWordsByTopic("t1").map((word) => word.id)).toEqual([
      "w-a",
      "w-b",
      "w-c",
    ])
    expect(getWordsByTopic("t2").map((word) => word.id)).toEqual(["w-c"])
  })

  it("exposes every word, pack, and avatar for the builders", () => {
    loadContent(BUNDLE)

    expect(getAllWords().map((word) => word.id)).toEqual(["w-a", "w-b", "w-c"])
    expect(getAllPacks().map((pack) => pack.id)).toEqual(["t1-b", "t1-a", "t2-a"])
    expect(getAvatarSet().map((avatar) => avatar.id)).toEqual(["luma"])
  })

  it("freezes the bundle and every collection it derives", () => {
    loadContent(BUNDLE)

    expect(Object.isFrozen(BUNDLE.meta)).toBe(true)
    expect(Object.isFrozen(BUNDLE.words[0])).toBe(true)
    expect(Object.isFrozen(BUNDLE.words[0].topicIds)).toBe(true)
    expect(Object.isFrozen(getTopics())).toBe(true)
    expect(Object.isFrozen(getPacksByTopic("t1"))).toBe(true)
    expect(Object.isFrozen(getWordsByTopic("t1"))).toBe(true)
    expect(Object.isFrozen(getAvatarSet())).toBe(true)
    expect(Object.isFrozen(getWordsByIds(["w-a"]))).toBe(true)
  })

  it("replaces a previously loaded bundle", () => {
    loadContent(BUNDLE)
    loadContent({ ...BUNDLE, words: [makeWord("w-z", ["t1"])] })

    expect(getAllWords().map((word) => word.id)).toEqual(["w-z"])
    expect(getWord("w-a")).toBeUndefined()
  })
})

describe("clearContent", () => {
  it("returns the accessors to their empty state", () => {
    loadContent(BUNDLE)
    clearContent()

    expect(getAllWords()).toEqual([])
    expect(getTopics()).toEqual([])
    expect(getContentMeta().contentVersion).toBe("")
  })
})
