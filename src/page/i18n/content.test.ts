import { describe, expect, it } from "vitest"

import type { Word } from "@shared/types"
import { wordDefinition, wordExample, wordMeaning } from "./content"

const word: Word = {
  id: "w-build",
  text: "build",
  phonetic: "/bɪld/",
  partOfSpeech: "verb",
  meaningEn: "to make something",
  meaningZh: "建造",
  definitionEn: "to make something by putting parts together",
  definitionZh: "把各个部分组合起来做成某物",
  examples: [
    { en: "We build a sandcastle.", zh: "我们堆了一座沙堡。" },
    { en: "They build houses.", zh: "他们建造房子。" },
  ],
  image: "build.webp",
  level: 1,
  tags: [],
  topicIds: [],
}

describe("word content selectors", () => {
  it("selects the meaning by locale", () => {
    expect(wordMeaning(word, "en")).toBe("to make something")
    expect(wordMeaning(word, "zh")).toBe("建造")
  })

  it("selects the definition by locale", () => {
    expect(wordDefinition(word, "en")).toBe(
      "to make something by putting parts together",
    )
    expect(wordDefinition(word, "zh")).toBe("把各个部分组合起来做成某物")
  })

  it("selects an example by locale and index", () => {
    expect(wordExample(word, "en")).toBe("We build a sandcastle.")
    expect(wordExample(word, "zh")).toBe("我们堆了一座沙堡。")
    expect(wordExample(word, "en", 1)).toBe("They build houses.")
    expect(wordExample(word, "zh", 1)).toBe("他们建造房子。")
  })

  it("returns an empty string when the example index is out of range", () => {
    expect(wordExample(word, "en", 9)).toBe("")
  })
})
