import { describe, expect, it } from "vitest"

import { portalView } from "../access"

describe("portalView", () => {
  it("shows sign-in when no account is present", () => {
    expect(portalView({ hasAccount: false, role: null })).toBe("signed-out")
  })

  it("waits while a signed-in account's role is being resolved", () => {
    expect(portalView({ hasAccount: true, role: null })).toBe("loading")
  })

  it("refuses a signed-in user role", () => {
    expect(portalView({ hasAccount: true, role: "user" })).toBe("denied")
  })

  it("admits teacher and admin", () => {
    expect(portalView({ hasAccount: true, role: "teacher" })).toBe("staff")
    expect(portalView({ hasAccount: true, role: "admin" })).toBe("staff")
  })
})
