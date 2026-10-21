import { describe, expect, it } from "vitest"

import { buildHash, parseHash, parentOf, ROUTE_SAMPLES } from "./routes"

describe("parseHash / buildHash", () => {
  it("round-trips every supported route", () => {
    for (const route of ROUTE_SAMPLES) {
      expect(parseHash(buildHash(route))).toEqual(route)
    }
  })

  it("builds the canonical hash for every route", () => {
    expect(buildHash({ id: "home" })).toBe("#/home")
    expect(buildHash({ id: "session-intro" })).toBe("#/session/intro")
    expect(buildHash({ id: "words", tab: "wordbook" })).toBe(
      "#/words?tab=wordbook",
    )
    expect(buildHash({ id: "word-detail", wordId: "w-build" })).toBe(
      "#/words/w-build",
    )
  })

  it("parses the words tab", () => {
    expect(parseHash("#/words?tab=collection")).toEqual({
      id: "words",
      tab: "collection",
    })
    expect(parseHash("#/words?tab=wordbook")).toEqual({
      id: "words",
      tab: "wordbook",
    })
  })

  it("treats a bare words route as the collection tab", () => {
    expect(parseHash("#/words")).toEqual({ id: "words", tab: "collection" })
  })

  it("parses a word id and decodes it", () => {
    expect(parseHash("#/words/w-build")).toEqual({
      id: "word-detail",
      wordId: "w-build",
    })
    expect(parseHash("#/words/w%20build")).toEqual({
      id: "word-detail",
      wordId: "w build",
    })
  })

  it("carries the tab a word detail was opened from", () => {
    expect(
      buildHash({ id: "word-detail", wordId: "w-build", tab: "wordbook" }),
    ).toBe("#/words/w-build?tab=wordbook")
    expect(parseHash("#/words/w-build?tab=wordbook")).toEqual({
      id: "word-detail",
      wordId: "w-build",
      tab: "wordbook",
    })
    expect(parseHash("#/words/w-build?tab=collection")).toEqual({
      id: "word-detail",
      wordId: "w-build",
      tab: "collection",
    })
  })

  it("rejects a bogus word-detail tab", () => {
    expect(parseHash("#/words/w-build?tab=bogus")).toBeNull()
  })

  it("returns a word detail to the tab it was opened from", () => {
    expect(parentOf({ id: "word-detail", wordId: "w-build" })).toEqual({
      id: "words",
      tab: "collection",
    })
    expect(
      parentOf({ id: "word-detail", wordId: "w-build", tab: "wordbook" }),
    ).toEqual({ id: "words", tab: "wordbook" })
  })

  it("accepts a single trailing slash on known paths", () => {
    expect(parseHash("#/home/")).toEqual({ id: "home" })
    expect(parseHash("#/session/intro/")).toEqual({ id: "session-intro" })
    expect(parseHash("#/words/")).toEqual({ id: "words", tab: "collection" })
  })

  it("falls back on unknown or malformed hashes", () => {
    const malformed = [
      "",
      "#",
      "#/",
      "#/nope",
      "#/home/extra",
      "#/session/extra",
      "#/words?tab=bogus",
      "#/words/%20",
      "home",
      "#/Home",
    ]

    for (const hash of malformed) {
      expect(parseHash(hash), hash).toBeNull()
    }
  })

  it("ignores unrelated query parameters", () => {
    expect(parseHash("#/home?from=install")).toEqual({ id: "home" })
    expect(parseHash("#/words?tab=wordbook&scroll=12")).toEqual({
      id: "words",
      tab: "wordbook",
    })
  })
})
