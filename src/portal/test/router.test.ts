import { describe, expect, it } from "vitest"

import { parsePortalHash, routeHref, sectionOf } from "../router"

describe("parsePortalHash", () => {
  it("reads the list screens", () => {
    expect(parsePortalHash("#/topics")).toEqual({ screen: "topics" })
    expect(parsePortalHash("#/words")).toEqual({ screen: "words" })
    expect(parsePortalHash("#/archived")).toEqual({
      screen: "archived",
      tab: "topics",
    })
  })

  it("reads a topic editor and the packs beneath a topic", () => {
    expect(parsePortalHash("#/topics/craft-build")).toEqual({
      screen: "topic",
      topicId: "craft-build",
    })
    expect(parsePortalHash("#/topics/craft-build/packs")).toEqual({
      screen: "packs",
      topicId: "craft-build",
    })
  })

  it("treats 'new' as a create route, never as an id", () => {
    expect(parsePortalHash("#/topics/new")).toEqual({ screen: "topicNew" })
    expect(parsePortalHash("#/topics/craft-build/packs/new")).toEqual({
      screen: "packNew",
      topicId: "craft-build",
    })
  })

  it("reads a pack editor by the pack's own id", () => {
    expect(parsePortalHash("#/packs/craft-build-1")).toEqual({
      screen: "pack",
      packId: "craft-build-1",
    })
  })

  it("reads the word library, a word editor, and create with a pack", () => {
    expect(parsePortalHash("#/words/w-brave")).toEqual({
      screen: "word",
      wordId: "w-brave",
    })
    expect(parsePortalHash("#/words/new")).toEqual({ screen: "wordNew" })
    expect(parsePortalHash("#/words/new?pack=craft-build-1")).toEqual({
      screen: "wordNew",
      packId: "craft-build-1",
    })
  })

  it("reads a pack's contents as its own screen", () => {
    expect(parsePortalHash("#/packs/craft-build-1/contents")).toEqual({
      screen: "packContents",
      packId: "craft-build-1",
    })
  })

  it("reads the two archived tabs", () => {
    expect(parsePortalHash("#/archived/topics")).toEqual({
      screen: "archived",
      tab: "topics",
    })
    expect(parsePortalHash("#/archived/packs")).toEqual({
      screen: "archived",
      tab: "packs",
    })
  })

  it("accepts the fragment with or without a slash, trailing slashes, and a query", () => {
    expect(parsePortalHash("topics")).toEqual({ screen: "topics" })
    expect(parsePortalHash("#/topics/")).toEqual({ screen: "topics" })
    expect(parsePortalHash("#/topics/craft-build/?x=1")).toEqual({
      screen: "topic",
      topicId: "craft-build",
    })
  })

  it("lands on Topics for an empty, unknown, or malformed fragment", () => {
    expect(parsePortalHash("")).toEqual({ screen: "topics" })
    expect(parsePortalHash("#")).toEqual({ screen: "topics" })
    expect(parsePortalHash("#/")).toEqual({ screen: "topics" })
    expect(parsePortalHash("#/nope")).toEqual({ screen: "topics" })
    expect(parsePortalHash("#/topics//packs")).toEqual({ screen: "topics" })
    expect(parsePortalHash("#/packs")).toEqual({ screen: "topics" })
    expect(parsePortalHash("#/words/new/extra")).toEqual({ screen: "topics" })
    expect(parsePortalHash("#/packs/craft-build-1/contents/extra")).toEqual({
      screen: "topics",
    })
  })

  it("defaults an unknown archived tab to topics", () => {
    expect(parsePortalHash("#/archived/other")).toEqual({
      screen: "archived",
      tab: "topics",
    })
  })
})

describe("routeHref", () => {
  it("round-trips every route through the hash it is addressed by", () => {
    const routes = [
      { screen: "topics" },
      { screen: "topicNew" },
      { screen: "topic", topicId: "craft-build" },
      { screen: "packs", topicId: "craft-build" },
      { screen: "packNew", topicId: "craft-build" },
      { screen: "pack", packId: "craft-build-1" },
      { screen: "packContents", packId: "craft-build-1" },
      { screen: "words" },
      { screen: "wordNew" },
      { screen: "wordNew", packId: "craft-build-1" },
      { screen: "word", wordId: "w-brave" },
      { screen: "archived", tab: "topics" },
      { screen: "archived", tab: "packs" },
    ] as const

    for (const route of routes) {
      const href = routeHref(route)

      expect(href.startsWith("#/"), JSON.stringify(route)).toBe(true)
      expect(parsePortalHash(href), JSON.stringify(route)).toEqual(route)
    }
  })

  it("carries the pack into a create-with-pack href", () => {
    expect(routeHref({ screen: "wordNew", packId: "craft-build-1" })).toBe(
      "#/words/new?pack=craft-build-1",
    )
    expect(routeHref({ screen: "packContents", packId: "craft-build-1" })).toBe(
      "#/packs/craft-build-1/contents",
    )
  })

  it("spells the create and order paths the screens link to", () => {
    expect(routeHref({ screen: "topicNew" })).toBe("#/topics/new")
    expect(routeHref({ screen: "packNew", topicId: "craft-build" })).toBe(
      "#/topics/craft-build/packs/new",
    )
    expect(routeHref({ screen: "pack", packId: "craft-build-1" })).toBe(
      "#/packs/craft-build-1",
    )
  })
})

describe("sectionOf", () => {
  it("keeps every topic and pack route under Topics", () => {
    for (const route of [
      { screen: "topics" },
      { screen: "topicNew" },
      { screen: "topic", topicId: "craft-build" },
      { screen: "packs", topicId: "craft-build" },
      { screen: "packNew", topicId: "craft-build" },
      { screen: "pack", packId: "craft-build-1" },
    ] as const) {
      expect(sectionOf(route), JSON.stringify(route)).toBe("topics")
    }
  })

  it("marks the words and archived sections", () => {
    expect(sectionOf({ screen: "words" })).toBe("words")
    expect(sectionOf({ screen: "archived", tab: "packs" })).toBe("archived")
  })

  it("keeps word routes under Words but pack contents under Topics", () => {
    expect(sectionOf({ screen: "wordNew" })).toBe("words")
    expect(sectionOf({ screen: "wordNew", packId: "craft-build-1" })).toBe(
      "words",
    )
    expect(sectionOf({ screen: "word", wordId: "w-brave" })).toBe("words")
    expect(sectionOf({ screen: "packContents", packId: "craft-build-1" })).toBe(
      "topics",
    )
  })
})
