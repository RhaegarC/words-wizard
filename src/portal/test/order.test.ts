import { describe, expect, it } from "vitest"

import { moveId } from "../order"

describe("moveId", () => {
  it("moves an id one position up or down", () => {
    expect(moveId(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"])
    expect(moveId(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"])
    expect(moveId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"])
  })

  it("does nothing at either edge", () => {
    expect(moveId(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"])
    expect(moveId(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"])
  })

  it("does nothing for an id that is not in the list", () => {
    expect(moveId(["a", "b"], "missing", 1)).toEqual(["a", "b"])
  })

  it("does not mutate the list it was given", () => {
    const ids = ["a", "b", "c"]
    const moved = moveId(ids, "b", -1)

    expect(ids).toEqual(["a", "b", "c"])
    expect(moved).not.toBe(ids)
  })
})
