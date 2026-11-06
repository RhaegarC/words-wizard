import { describe, expect, it } from "vitest"

import { addMembers, isDirty, removeMember } from "../membership"

/**
 * The pack-contents screen edits a working draft and commits the whole list.
 * These helpers are pure so the draft's rules are decidable without a DOM.
 */

describe("addMembers", () => {
  it("appends the new ids in the order they were chosen", () => {
    expect(addMembers(["w-a"], ["w-c", "w-b"])).toEqual(["w-a", "w-c", "w-b"])
  })

  it("ignores a word already in the draft and a repeated choice", () => {
    expect(addMembers(["w-a"], ["w-a", "w-b", "w-b"])).toEqual(["w-a", "w-b"])
  })

  it("does not mutate the draft it is given", () => {
    const draft = ["w-a"]

    addMembers(draft, ["w-b"])
    expect(draft).toEqual(["w-a"])
  })
})

describe("removeMember", () => {
  it("removes the word and keeps the rest in order", () => {
    expect(removeMember(["w-a", "w-b", "w-c"], "w-b")).toEqual(["w-a", "w-c"])
  })

  it("leaves the draft unchanged when the id is absent", () => {
    expect(removeMember(["w-a"], "w-z")).toEqual(["w-a"])
  })
})

describe("isDirty", () => {
  it("compares by order, not only by membership", () => {
    expect(isDirty(["w-a", "w-b"], ["w-a", "w-b"])).toBe(false)
    expect(isDirty(["w-b", "w-a"], ["w-a", "w-b"])).toBe(true)
    expect(isDirty(["w-a"], ["w-a", "w-b"])).toBe(true)
    expect(isDirty([], [])).toBe(false)
  })
})
