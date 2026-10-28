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
  image: "art/w-bag.webp",
  emoji: "🎒",
  level: 1,
  tags: [],
  topicIds: ["craft-and-build"],
}

describe("resolveArtwork", () => {
  it("uses the approved file when the manifest says approved", () => {
    expect(
      resolveArtwork(word, { file: "art/w-bag.webp", status: "approved" }),
    ).toEqual({ kind: "image", src: "./art/w-bag.webp" })
  })

  it("returns a placeholder for a placeholder manifest entry", () => {
    expect(
      resolveArtwork(word, { file: "art/w-bag.webp", status: "placeholder" }),
    ).toEqual({ kind: "placeholder", emoji: "🎒", label: "bag" })
  })

  it("returns a placeholder when the word has no manifest entry", () => {
    expect(resolveArtwork(word, undefined).kind).toBe("placeholder")
  })

  it("falls back to the word's initial when there is no emoji", () => {
    expect(resolveArtwork({ ...word, emoji: undefined }, undefined)).toEqual({
      kind: "placeholder",
      emoji: "B",
      label: "bag",
    })
  })

  it("leaves absolute asset paths untouched", () => {
    expect(
      resolveArtwork(word, { file: "/art/w-bag.webp", status: "approved" }),
    ).toEqual({ kind: "image", src: "/art/w-bag.webp" })
  })
})
