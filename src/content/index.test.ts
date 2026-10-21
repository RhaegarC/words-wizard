import { describe, expect, it } from "vitest"

import {
  getAllPacks,
  getAllWords,
  getArtwork,
  getAvatarSet,
  getContentMeta,
  getPack,
  getPacksByTopic,
  getTopic,
  getTopics,
  getWord,
  getWordsByIds,
  getWordsByTopic,
} from "./index"

describe("content data access", () => {
  it("lists the five topics", () => {
    const topics = getTopics()

    expect(topics).toHaveLength(5)
    expect(topics.map((topic) => topic.id)).toEqual([
      "craft-and-build",
      "explore-and-discover",
      "puzzle-and-mystery",
      "co-op-quest",
      "battle-and-survive",
    ])
  })

  it("looks up a topic by id, and returns undefined for an unknown one", () => {
    expect(getTopic("craft-and-build")?.title).toBe("Craft & Build")
    expect(getTopic("nope")).toBeUndefined()
  })

  it("returns a topic's packs in order", () => {
    expect(getPacksByTopic("craft-and-build").map((pack) => pack.order)).toEqual([
      1, 2, 3,
    ])
    expect(getPacksByTopic("nope")).toEqual([])
  })

  it("looks up a pack and its slots", () => {
    expect(getPack("craft-1")?.wordIds).toHaveLength(20)
    expect(getPack("nope")).toBeUndefined()
  })

  it("looks up a word and returns undefined rather than throwing", () => {
    expect(getWord("w-bag")?.text).toBe("bag")
    expect(getWord("nope")).toBeUndefined()
  })

  it("resolves ids in the requested order and skips unknown ones", () => {
    expect(getWordsByIds(["w-ball", "nope", "w-bag"]).map((word) => word.id)).toEqual(
      ["w-ball", "w-bag"],
    )
  })

  it("lists the authored words for a topic", () => {
    const words = getWordsByTopic("craft-and-build")

    expect(words).toHaveLength(20)
    expect(words.every((word) => word.topicIds.includes("craft-and-build"))).toBe(
      true,
    )
    expect(getWordsByTopic("nope")).toEqual([])
  })

  it("exposes every word and pack for the session builder", () => {
    expect(getAllWords().map((word) => word.id)).toContain("w-bag")
    expect(getAllPacks().map((pack) => pack.id)).toContain("craft-1")
    expect(Object.isFrozen(getAllWords())).toBe(true)
    expect(Object.isFrozen(getAllPacks())).toBe(true)
  })

  it("exposes the three avatars with five stages each", () => {
    const avatars = getAvatarSet()

    expect(avatars.map((avatar) => avatar.id)).toEqual([
      "luma",
      "pippin",
      "moss",
    ])

    for (const avatar of avatars) {
      expect(Object.keys(avatar.stages)).toHaveLength(5)
    }
  })

  it("returns the artwork entry for a word", () => {
    expect(getArtwork("w-bag")?.file).toBe("art/w-bag.webp")
    expect(getArtwork("nope")).toBeUndefined()
  })

  it("exposes the content metadata", () => {
    expect(getContentMeta()).toMatchObject({
      schemaVersion: 1,
      dataset: "dev",
    })
  })

  it("freezes the returned collections", () => {
    expect(Object.isFrozen(getTopics())).toBe(true)
    expect(Object.isFrozen(getWordsByTopic("craft-and-build"))).toBe(true)
    expect(Object.isFrozen(getAvatarSet())).toBe(true)
  })
})
