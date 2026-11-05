import { describe, expect, it } from "vitest"

import { AuthConfigError, readAuthConfig } from "../../auth/config"

const ENV = {
  VITE_ENTRA_CLIENT_ID: "client-id",
  VITE_ENTRA_TENANT_ID: "tenant-id",
  VITE_ENTRA_SCOPE: "api://client-id/access_as_user",
  VITE_API_BASE_URL: "https://api.example.test",
}

describe("readAuthConfig", () => {
  it("builds the authority, redirect, and scope set", () => {
    expect(readAuthConfig(ENV, "https://words.example.test")).toEqual({
      clientId: "client-id",
      tenantId: "tenant-id",
      apiBaseUrl: "https://api.example.test",
      avatarBaseUrl: "https://api.example.test/v1/avatars",
      authority: "https://login.microsoftonline.com/tenant-id",
      redirectUri: "https://words.example.test/",
      postLogoutRedirectUri: "https://words.example.test/",
      scopes: ["openid", "profile", "api://client-id/access_as_user"],
    })
  })

  it("strips trailing slashes from the API base url", () => {
    expect(
      readAuthConfig(
        { ...ENV, VITE_API_BASE_URL: "https://api.example.test///" },
        "https://words.example.test",
      ).apiBaseUrl,
    ).toBe("https://api.example.test")
  })

  it("uses the configured avatar base and strips its trailing slash", () => {
    expect(
      readAuthConfig(
        {
          ...ENV,
          VITE_AVATAR_BASE_URL: " https://avatars.example.test/// ",
        },
        "https://words.example.test",
      ).avatarBaseUrl,
    ).toBe("https://avatars.example.test")
    expect(
      readAuthConfig(
        { ...ENV, VITE_AVATAR_BASE_URL: "  " },
        "https://words.example.test",
      ).avatarBaseUrl,
    ).toBe("https://api.example.test/v1/avatars")
  })
  it("trims surrounding whitespace", () => {
    expect(
      readAuthConfig(
        {
          ...ENV,
          VITE_ENTRA_CLIENT_ID: "  client-id  ",
          VITE_ENTRA_TENANT_ID: " tenant-id\n",
        },
        "https://words.example.test",
      ),
    ).toMatchObject({ clientId: "client-id", tenantId: "tenant-id" })
  })

  it.each([
    "VITE_ENTRA_CLIENT_ID",
    "VITE_ENTRA_TENANT_ID",
    "VITE_ENTRA_SCOPE",
    "VITE_API_BASE_URL",
  ] as const)("refuses a missing %s and names it", (key) => {
    const env = { ...ENV, [key]: undefined }

    expect(() =>
      readAuthConfig(env, "https://words.example.test"),
    ).toThrowError(
      AuthConfigError,
    )

    try {
      readAuthConfig(env, "https://words.example.test")
    } catch (error) {
      expect((error as AuthConfigError).key).toBe(key)
      expect((error as Error).message).toContain(key)
    }
  })

  it("treats a blank value as missing", () => {
    expect(() =>
      readAuthConfig(
        { ...ENV, VITE_ENTRA_SCOPE: "   " },
        "https://words.example.test",
      ),
    ).toThrowError(/VITE_ENTRA_SCOPE/)
  })
})
