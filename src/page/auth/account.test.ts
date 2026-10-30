import { describe, expect, it } from "vitest"

import { accountDisplayName, accountOid } from "./account"

describe("accountOid", () => {
  it("reads the Entra object id from the ID token claims", () => {
    expect(
      accountOid({
        localAccountId: "local-1",
        idTokenClaims: { oid: "oid-1" },
      }),
    ).toBe("oid-1")
  })

  it("falls back to the local account id when the claim is absent", () => {
    expect(
      accountOid({ localAccountId: "local-1", idTokenClaims: {} }),
    ).toBe("local-1")
    expect(accountOid({ localAccountId: "local-1" })).toBe("local-1")
  })

  it("refuses an empty or non-string claim", () => {
    expect(
      accountOid({ localAccountId: "local-1", idTokenClaims: { oid: " " } }),
    ).toBe("local-1")
    expect(
      accountOid({ localAccountId: "local-1", idTokenClaims: { oid: 7 } }),
    ).toBe("local-1")
  })

  it("returns null without an account", () => {
    expect(accountOid(null)).toBeNull()
  })
})

describe("accountDisplayName", () => {
  it("prefers the display name, then the username", () => {
    expect(
      accountDisplayName({ localAccountId: "l", name: "Mia Chen", username: "mia@example.test" }),
    ).toBe("Mia Chen")
    expect(
      accountDisplayName({ localAccountId: "l", username: "mia@example.test" }),
    ).toBe("mia@example.test")
  })

  it("falls back to an empty string", () => {
    expect(accountDisplayName(null)).toBe("")
    expect(accountDisplayName({ localAccountId: "l" })).toBe("")
  })
})
