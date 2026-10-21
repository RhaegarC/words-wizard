import { describe, expect, it } from "vitest"

import { createRng, hashString, shuffle } from "./random"

describe("hashString", () => {
  it("is stable for the same input and differs for different inputs", () => {
    expect(hashString("1|2026-10-21|daily|dev")).toBe(
      hashString("1|2026-10-21|daily|dev"),
    )
    expect(hashString("1|2026-10-21|daily|dev")).not.toBe(
      hashString("1|2026-10-22|daily|dev"),
    )
  })
})

describe("createRng", () => {
  it("produces the same stream for the same seed", () => {
    const first = createRng(42)
    const second = createRng(42)

    const firstRun = Array.from({ length: 8 }, () => first())
    const secondRun = Array.from({ length: 8 }, () => second())

    expect(firstRun).toEqual(secondRun)
  })

  it("stays inside [0, 1)", () => {
    const rng = createRng(7)

    for (let index = 0; index < 100; index += 1) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe("shuffle", () => {
  it("returns every item once and does not mutate the input", () => {
    const input = ["a", "b", "c", "d", "e"]
    const result = shuffle(input, createRng(3))

    expect([...result].sort()).toEqual([...input].sort())
    expect(input).toEqual(["a", "b", "c", "d", "e"])
  })

  it("is deterministic for the same seed and can differ for another", () => {
    const input = ["a", "b", "c", "d", "e", "f"]

    expect(shuffle(input, createRng(1))).toEqual(shuffle(input, createRng(1)))
    expect(shuffle(input, createRng(1))).not.toEqual(shuffle(input, createRng(2)))
  })
})
