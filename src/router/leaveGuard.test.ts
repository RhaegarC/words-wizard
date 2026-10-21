import { describe, expect, it } from "vitest"

import { createLeaveGuard } from "./leaveGuard"

describe("leave guard", () => {
  it("allows leaving when no handler is registered", () => {
    const guard = createLeaveGuard()

    expect(guard.canLeave()).toBe(true)
  })

  it("keeps the route when the handler vetoes", () => {
    const guard = createLeaveGuard()
    guard.setBeforeLeave(() => false)

    expect(guard.canLeave()).toBe(false)
  })

  it("allows the change when the handler agrees", () => {
    const guard = createLeaveGuard()
    guard.setBeforeLeave(() => true)

    expect(guard.canLeave()).toBe(true)
  })

  it("clears a handler so leaving is allowed again", () => {
    const guard = createLeaveGuard()
    guard.setBeforeLeave(() => false)
    guard.setBeforeLeave(null)

    expect(guard.canLeave()).toBe(true)
  })

  it("fails open when a handler throws, so the child is never trapped", () => {
    const guard = createLeaveGuard()
    guard.setBeforeLeave(() => {
      throw new Error("handler bug")
    })

    expect(guard.canLeave()).toBe(true)
  })
})
