import { describe, expect, it } from "vitest"

import { buildHash, parseHash, parentOf, ROUTE_SAMPLES } from "../../router/routes"

describe("parseHash / buildHash", () => {
  it("round-trips every supported route", () => {
    for (const route of ROUTE_SAMPLES) {
      expect(parseHash(buildHash(route))).toEqual(route)
    }
  })

  it("no longer has a standalone badges route", () => {
    expect(parseHash("#/badges")).toBeNull()
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

  it("builds and parses the review exercise route", () => {
    expect(buildHash({ id: "review-exercise" })).toBe("#/review/exercise")
    expect(parseHash("#/review/exercise")).toEqual({ id: "review-exercise" })
    expect(parentOf({ id: "review-exercise" })).toEqual({ id: "review" })
  })

  it("builds and parses the practice hub and free-practice family", () => {
    expect(buildHash({ id: "session-hub" })).toBe("#/session/hub")
    expect(parseHash("#/session/hub")).toEqual({ id: "session-hub" })
    expect(buildHash({ id: "session-free" })).toBe("#/session/free")
    expect(parseHash("#/session/free")).toEqual({ id: "session-free" })

    const pack = { id: "session-free-pack" as const, packId: "craft-1" }
    const exercise = { id: "session-free-exercise" as const, packId: "craft-1" }
    const summary = { id: "session-free-summary" as const, packId: "craft-1" }

    expect(buildHash(pack)).toBe("#/session/free/craft-1")
    expect(parseHash("#/session/free/craft-1")).toEqual(pack)
    expect(buildHash(exercise)).toBe("#/session/free/craft-1/exercise")
    expect(parseHash("#/session/free/craft-1/exercise")).toEqual(exercise)
    expect(buildHash(summary)).toBe("#/session/free/craft-1/summary")
    expect(parseHash("#/session/free/craft-1/summary")).toEqual(summary)

    expect(parentOf({ id: "session-hub" })).toEqual({ id: "home" })
    expect(parentOf({ id: "session-free" })).toEqual({ id: "session-hub" })
    expect(parentOf(pack)).toEqual({ id: "session-free" })
    expect(parentOf(exercise)).toEqual(pack)
    expect(parentOf(summary)).toEqual(pack)
  })

  it("decodes a free-practice pack id and rejects an empty one", () => {
    expect(parseHash("#/session/free/craft%201")).toEqual({
      id: "session-free-pack",
      packId: "craft 1",
    })
    expect(parseHash("#/session/free/%20")).toBeNull()
  })

  it("builds and parses the exam family", () => {
    expect(buildHash({ id: "session-exam" })).toBe("#/session/exam")
    expect(parseHash("#/session/exam")).toEqual({ id: "session-exam" })

    const part = { id: "session-exam-part" as const, index: 0 }
    expect(buildHash(part)).toBe("#/session/exam/part/0")
    expect(parseHash("#/session/exam/part/0")).toEqual(part)
    expect(parseHash("#/session/exam/part/3")).toEqual({
      id: "session-exam-part",
      index: 3,
    })

    expect(buildHash({ id: "session-exam-summary" })).toBe(
      "#/session/exam/summary",
    )
    expect(parseHash("#/session/exam/summary")).toEqual({
      id: "session-exam-summary",
    })

    expect(parentOf({ id: "session-exam" })).toEqual({ id: "session-hub" })
    expect(parentOf(part)).toEqual({ id: "session-exam" })
    expect(parentOf({ id: "session-exam-summary" })).toEqual({
      id: "session-exam",
    })
  })

  it("rejects malformed exam part indexes", () => {
    expect(parseHash("#/session/exam/part")).toBeNull()
    expect(parseHash("#/session/exam/part/one")).toBeNull()
    expect(parseHash("#/session/exam/part/-1")).toBeNull()
    expect(parseHash("#/session/exam/part/0/extra")).toBeNull()
  })

  it("carries the settings origin through the topic picker", () => {
    expect(buildHash({ id: "topics", from: "settings" })).toBe(
      "#/topics?from=settings",
    )
    expect(parseHash("#/topics?from=settings")).toEqual({
      id: "topics",
      from: "settings",
    })
    expect(parentOf({ id: "topics", from: "settings" })).toEqual({
      id: "settings",
    })
  })

  it("keeps the first-run topic picker returning home", () => {
    expect(buildHash({ id: "topics" })).toBe("#/topics")
    expect(parseHash("#/topics")).toEqual({ id: "topics" })
    expect(parentOf({ id: "topics" })).toEqual({ id: "home" })
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
