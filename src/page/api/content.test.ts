import { describe, expect, it, vi } from "vitest"

import type { ContentBundle } from "@shared/content/types"

import type { ApiClient } from "./client"
import { ContentError, fetchContent, isContentBundle } from "./content"

function bundle(): ContentBundle {
  return {
    meta: { schemaVersion: 1, dataset: "dev", contentVersion: "v1" },
    topics: [
      {
        id: "t-1",
        title: "Topic",
        titleZh: "主题",
        icon: "🔤",
        description: "d",
        descriptionZh: "d",
        sortOrder: 1,
      },
    ],
    packs: [
      {
        id: "p-1",
        title: "Pack",
        titleZh: "包",
        topicId: "t-1",
        wordIds: ["w-1"],
        order: 1,
      },
    ],
    words: [
      {
        id: "w-1",
        text: "bag",
        phonetic: "/bæg/",
        partOfSpeech: "noun",
        meaningEn: "a bag",
        meaningZh: "包",
        definitionEn: "d",
        definitionZh: "d",
        examples: [{ en: "A bag.", zh: "一个包。" }],
        image: null,
        emoji: "🎒",
        level: 1,
        tags: [],
        topicIds: ["t-1"],
      },
    ],
    avatars: [],
  }
}

function clientReturning(value: unknown): ApiClient & { request: ReturnType<typeof vi.fn> } {
  return { request: vi.fn().mockResolvedValue(value) }
}

describe("isContentBundle", () => {
  it("accepts a well-formed bundle", () => {
    expect(isContentBundle(bundle())).toBe(true)
  })

  it.each([
    ["null", null],
    ["a string", "bundle"],
    ["an array", []],
    ["a missing meta", { ...bundle(), meta: undefined }],
    ["a non-array topics", { ...bundle(), topics: {} }],
    ["a non-array words", { ...bundle(), words: null }],
    ["a topic without an id", { ...bundle(), topics: [{}] }],
    ["a malformed meta", { ...bundle(), meta: { schemaVersion: "1" } }],
  ])("rejects %s", (_label, value) => {
    expect(isContentBundle(value)).toBe(false)
  })
})

describe("fetchContent", () => {
  it("requests the bundle and returns it", async () => {
    const client = clientReturning(bundle())

    await expect(fetchContent(client)).resolves.toEqual(bundle())
    expect(client.request).toHaveBeenCalledWith("/v1/content")
  })

  it("refuses a malformed bundle rather than loading it", async () => {
    const client = clientReturning({ topics: [] })

    await expect(fetchContent(client)).rejects.toBeInstanceOf(ContentError)
  })
})
