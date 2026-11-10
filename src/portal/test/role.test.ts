import { describe, expect, it } from "vitest"

import { roleFromAccessToken } from "../role"

/**
 * The portal's UX-only role read. The Worker is the enforcement point; this
 * decides which shell to draw before the first admin request returns.
 */

function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64url")

  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`
}

describe("roleFromAccessToken", () => {
  it("reads a single role", () => {
    expect(roleFromAccessToken(token({ roles: ["teacher"] }))).toBe("teacher")
    expect(roleFromAccessToken(token({ roles: ["admin"] }))).toBe("admin")
    expect(roleFromAccessToken(token({ roles: ["user"] }))).toBe("user")
  })

  it("lets admin outrank teacher and user", () => {
    expect(roleFromAccessToken(token({ roles: ["user", "teacher"] }))).toBe(
      "teacher",
    )
    expect(
      roleFromAccessToken(token({ roles: ["user", "teacher", "admin"] })),
    ).toBe("admin")
  })

  it("resolves a missing, malformed, or unknown claim to user", () => {
    for (const payload of [
      {},
      { roles: [] },
      { roles: "admin" },
      { roles: [42] },
      { roles: ["superuser"] },
    ]) {
      expect(roleFromAccessToken(token(payload))).toBe("user")
    }
  })

  it("resolves an unreadable token to user rather than throwing", () => {
    for (const value of ["", "not-a-jwt", "a.!!!.c", "a.b"]) {
      expect(roleFromAccessToken(value)).toBe("user")
    }
  })
})
