import { describe, expect, it } from "vitest"

import { parsePortalHash, screenHref } from "../router"

describe("parsePortalHash", () => {
  it("reads the three shell screens", () => {
    expect(parsePortalHash("#/topics")).toBe("topics")
    expect(parsePortalHash("#/words")).toBe("words")
    expect(parsePortalHash("#/archived")).toBe("archived")
  })

  it("accepts the fragment with or without a slash", () => {
    expect(parsePortalHash("#topics")).toBe("topics")
    expect(parsePortalHash("topics")).toBe("topics")
    expect(parsePortalHash("#/words/")).toBe("words")
  })

  it("lands on Topics for an empty or unknown fragment", () => {
    expect(parsePortalHash("")).toBe("topics")
    expect(parsePortalHash("#")).toBe("topics")
    expect(parsePortalHash("#/")).toBe("topics")
    expect(parsePortalHash("#/nope")).toBe("topics")
  })

  it("ignores a query or sub-path after the screen", () => {
    expect(parsePortalHash("#/words?level=2")).toBe("words")
    expect(parsePortalHash("#/archived/topics")).toBe("archived")
  })
})

describe("screenHref", () => {
  it("builds the hash route each screen is addressed by", () => {
    expect(screenHref("topics")).toBe("#/topics")
    expect(screenHref("words")).toBe("#/words")
    expect(screenHref("archived")).toBe("#/archived")
  })
})
