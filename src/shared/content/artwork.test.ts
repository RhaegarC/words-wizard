import { describe, expect, it } from "vitest"

import type { Word } from "../types"
import { resolveArtwork } from "./artwork"

const word: Word = {
  id: "w-bag",
  text: "bag",
  phonetic: "/bæɡ/",
  partOfSpeech: "noun",
  meaningEn: "a thing you carry",
  meaningZh: "包",
  definitionEn: "You put things inside a bag.",
  definitionZh: "你可以把东西放进包里。",
  examples: [{ en: "My bag is blue.", zh: "我的包是蓝色的。" }],
  image: "https://images.example.test/w-bag.webp",
  emoji: "🎒",
  level: 1,
  tags: [],
  topicIds: ["craft-and-build"],
}

describe("resolveArtwork", () => {
  it("uses the word's image URL when it has one", () => {
    expect(resolveArtwork(word)).toEqual({
      kind: "image",
      src: "https://images.example.test/w-bag.webp",
    })
  })

  it("leaves an absolute asset path untouched", () => {
    expect(resolveArtwork({ ...word, image: "/art/w-bag.webp" })).toEqual({
      kind: "image",
      src: "/art/w-bag.webp",
    })
  })

  it("returns a placeholder when the word has no image", () => {
    expect(resolveArtwork({ ...word, image: null })).toEqual({
      kind: "placeholder",
      emoji: "🎒",
      label: "bag",
    })
  })

  it("treats an empty image as absent", () => {
    expect(resolveArtwork({ ...word, image: " " }).kind).toBe("placeholder")
  })

  it("falls back to the word's initial when there is no emoji", () => {
    expect(
      resolveArtwork({ ...word, image: null, emoji: undefined }),
    ).toEqual({
      kind: "placeholder",
      emoji: "B",
      label: "bag",
    })
  })
})
