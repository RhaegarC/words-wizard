import { describe, expect, it, vi } from "vitest"

import {
  NoAccountError,
  RedirectingError,
  createTokenGetter,
  type TokenSource,
} from "./token"

const SCOPES = ["openid", "profile", "api://client/access_as_user"]

function account() {
  return {
    localAccountId: "local-1",
    idTokenClaims: { oid: "oid-1" },
  }
}

function source(overrides: Partial<TokenSource> = {}): TokenSource {
  return {
    getActiveAccount: () => account(),
    acquireTokenSilent: vi
      .fn()
      .mockResolvedValue({ accessToken: "silent-token" }),
    acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("createTokenGetter", () => {
  it("returns the silently acquired access token", async () => {
    const tokens = source()
    const getAccessToken = createTokenGetter(tokens, SCOPES)

    await expect(getAccessToken()).resolves.toBe("silent-token")
    expect(tokens.acquireTokenSilent).toHaveBeenCalledWith({
      account: account(),
      scopes: SCOPES,
      forceRefresh: undefined,
    })
    expect(tokens.acquireTokenRedirect).not.toHaveBeenCalled()
  })

  it("passes the refresh flag through", async () => {
    const tokens = source()
    const getAccessToken = createTokenGetter(tokens, SCOPES)

    await getAccessToken({ forceRefresh: true })

    expect(tokens.acquireTokenSilent).toHaveBeenCalledWith({
      account: account(),
      scopes: SCOPES,
      forceRefresh: true,
    })
  })

  it("redirects when interaction is required, and never resolves", async () => {
    const tokens = source({
      acquireTokenSilent: vi.fn().mockRejectedValue(
        Object.assign(new Error("interaction required"), {
          name: "InteractionRequiredAuthError",
        }),
      ),
    })
    const getAccessToken = createTokenGetter(tokens, SCOPES)

    await expect(getAccessToken()).rejects.toBeInstanceOf(RedirectingError)
    expect(tokens.acquireTokenRedirect).toHaveBeenCalledWith({
      account: account(),
      scopes: SCOPES,
    })
  })

  it("refuses without a signed-in account", async () => {
    const tokens = source({ getActiveAccount: () => null })
    const getAccessToken = createTokenGetter(tokens, SCOPES)

    await expect(getAccessToken()).rejects.toBeInstanceOf(NoAccountError)
    expect(tokens.acquireTokenSilent).not.toHaveBeenCalled()
  })

  it("propagates any other silent failure", async () => {
    const failure = new Error("network down")
    const tokens = source({
      acquireTokenSilent: vi.fn().mockRejectedValue(failure),
    })
    const getAccessToken = createTokenGetter(tokens, SCOPES)

    await expect(getAccessToken()).rejects.toBe(failure)
    expect(tokens.acquireTokenRedirect).not.toHaveBeenCalled()
  })
})
