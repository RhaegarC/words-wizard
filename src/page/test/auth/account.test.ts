import { describe, expect, it } from "vitest"

import {
  accountDisplayName,
  accountOid,
  toAccountLike,
} from "../../auth/account"

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

describe("toAccountLike", () => {
  const msalAccount = {
    homeAccountId: "uid.utid",
    environment: "login.microsoftonline.com",
    tenantId: "utid",
    localAccountId: "uid",
    username: "mia@example.test",
    name: "Mia Chen",
    idTokenClaims: { oid: "oid-1" },
  }

  /**
   * `acquireTokenSilent` derives its cache key from `homeAccountId` and
   * matches the stored credentials by `environment` and `tenantId`. An
   * account object without them makes the SDK throw after a successful
   * redirect, which the app reports as the generic boot error.
   */
  it("keeps the fields MSAL uses to find cached credentials", () => {
    expect(toAccountLike(msalAccount)).toMatchObject({
      homeAccountId: "uid.utid",
      environment: "login.microsoftonline.com",
      tenantId: "utid",
    })
  })

  it("still exposes the identity the UI needs", () => {
    const account = toAccountLike(msalAccount)

    expect(accountOid(account)).toBe("oid-1")
    expect(accountDisplayName(account)).toBe("Mia Chen")
  })

  it("returns null without an account", () => {
    expect(toAccountLike(null)).toBeNull()
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
