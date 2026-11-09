import { Hono } from "hono"
import { beforeAll, describe, expect, it } from "vitest"

import { createTokenVerifier, requireAuth } from "../auth"
import type { AppEnv } from "../context"
import { readConfig } from "../config"
import { installErrorHandlers } from "../errors"
import {
  AUDIENCE,
  ISSUER,
  TENANT,
  TEST_ENV,
  createTestKey,
  jwksFor,
  mintAlgNone,
  mintHs256,
  mintToken,
  mintTokenForOtherTenant,
  type TestKey,
} from "./tokens"

const config = readConfig(TEST_ENV)
const NOW = Math.floor(Date.now() / 1000)

let key: TestKey
let otherKey: TestKey
let verify: ReturnType<typeof createTokenVerifier>

beforeAll(async () => {
  key = await createTestKey()
  otherKey = await createTestKey()
  verify = createTokenVerifier(config, jwksFor(key))
})

async function expectRejected(token: string): Promise<void> {
  await expect(verify(token)).rejects.toThrow()
}

async function expectRejectedFor(
  verifier: ReturnType<typeof createTokenVerifier>,
  token: string,
): Promise<void> {
  await expect(verifier(token)).rejects.toThrow()
}

describe("createTokenVerifier", () => {
  it("accepts a valid token and returns the oid principal", async () => {
    await expect(verify(await mintToken(key))).resolves.toEqual({
      oid: "user-a",
      email: null,
      role: "user",
    })
  })

  it("accepts additional scopes alongside access_as_user", async () => {
    const token = await mintToken(key, { scp: "other_scope access_as_user" })

    await expect(verify(token)).resolves.toEqual({
      oid: "user-a",
      email: null,
      role: "user",
    })
  })
  describe("identity claims", () => {
    it("prefers the email claim over preferred_username", async () => {
      await expect(
        verify(
          await mintToken(key, {
            email: "mia@example.com",
            preferred_username: "upn@example.com",
          }),
        ),
      ).resolves.toMatchObject({ email: "mia@example.com" })
    })
    it("falls back to preferred_username when email is absent or blank", async () => {
      await expect(
        verify(await mintToken(key, { preferred_username: "upn@example.com" })),
      ).resolves.toMatchObject({ email: "upn@example.com" })
      await expect(
        verify(
          await mintToken(key, {
            email: "   ",
            preferred_username: "upn@example.com",
          }),
        ),
      ).resolves.toMatchObject({ email: "upn@example.com" })
    })
    it("stores no email when neither claim is usable", async () => {
      for (const claims of [
        {},
        { email: 42, preferred_username: null },
        { email: "", preferred_username: "  " },
      ]) {
        await expect(
          verify(await mintToken(key, claims)),
        ).resolves.toMatchObject(
          { email: null },
        )
      }
    })
    it("maps an admin or teacher role, admin first", async () => {
      await expect(
        verify(await mintToken(key, { roles: ["admin"] })),
      ).resolves.toMatchObject({ role: "admin" })
      await expect(
        verify(await mintToken(key, { roles: ["teacher", "user"] })),
      ).resolves.toMatchObject({ role: "teacher" })
      await expect(
        verify(await mintToken(key, { roles: ["teacher", "admin"] })),
      ).resolves.toMatchObject({ role: "admin" })
    })
    it("resolves a missing, malformed, or unknown role to user", async () => {
      for (const claims of [
        {},
        { roles: ["user"] },
        { roles: ["superuser"] },
        { roles: "admin" },
        { roles: [42] },
      ]) {
        await expect(
          verify(await mintToken(key, claims)),
        ).resolves.toMatchObject(
          { role: "user" },
        )
      }
    })
  })

  it("accepts a token expired within the 60-second clock tolerance", async () => {
    const token = await mintToken(key, { exp: NOW - 30 })

    await expect(verify(token)).resolves.toEqual({
      oid: "user-a",
      email: null,
      role: "user",
    })
  })

  describe("rejection matrix", () => {
    it("rejects an empty token", async () => {
      await expectRejected("")
    })

    it("rejects a malformed token", async () => {
      await expectRejected("not-a-jwt")
      await expectRejected("a.b.c")
    })

    it("rejects an expired token", async () => {
      await expectRejected(await mintToken(key, { exp: NOW - 300 }))
    })

    it("rejects a token whose nbf is in the future", async () => {
      await expectRejected(await mintToken(key, { nbf: NOW + 300 }))
    })

    it("rejects a token with no exp claim", async () => {
      await expectRejected(await mintToken(key, { exp: undefined }))
    })

    it("rejects a token signed by another key under the same kid", async () => {
      await expectRejected(await mintToken(otherKey, {}, key.kid))
    })

    it("rejects a token whose kid is not in the key set", async () => {
      await expectRejected(await mintToken(key, {}, "unknown-kid"))
    })

    it("rejects alg: none", async () => {
      await expectRejected(mintAlgNone())
    })

    it("rejects an HS256 token", async () => {
      await expectRejected(await mintHs256())
    })

    it("rejects a token from another issuer", async () => {
      await expectRejected(
        await mintToken(key, {
          iss: "https://sts.windows.net/tenant/v2.0",
        }),
      )
    })

    it("rejects a v1-shaped issuer", async () => {
      await expectRejected(
        await mintToken(key, {
          iss: "https://sts.windows.net/11111111-1111-1111-1111-111111111111/",
        }),
      )
    })

    it("rejects a token minted for another API", async () => {
      await expectRejected(
        await mintToken(key, { aud: "44444444-4444-4444-4444-444444444444" }),
      )
    })

    it("rejects a token from another tenant", async () => {
      await expectRejected(await mintTokenForOtherTenant(key))

      await expectRejected(await mintToken(key, { tid: "other-tenant" }))
    })

    it("rejects a token that does not carry access_as_user", async () => {
      await expectRejected(await mintToken(key, { scp: "other_scope" }))
      await expectRejected(await mintToken(key, { scp: "" }))
      await expectRejected(await mintToken(key, { scp: ["access_as_user"] }))
      await expectRejected(await mintToken(key, { scp: undefined }))
    })

    it("rejects a token with no usable oid", async () => {
      await expectRejected(await mintToken(key, { oid: undefined }))
      await expectRejected(await mintToken(key, { oid: "" }))
      await expectRejected(await mintToken(key, { oid: 42 }))
    })
  })

  /**
   * A multi-tenant registration answers the common authority, and the token
   * that comes back names the account's own home tenant. Roles, however, are
   * assigned by each tenant's own administrator, so only the home tenant's
   * roles may be trusted.
   */
  describe("multi-tenant authority", () => {
    const OTHER_TENANT = "33333333-3333-3333-3333-333333333333"
    const PERSONAL_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad"
    const MULTI_ISSUER = "https://login.example.test/common/v2.0"
    const MULTI_ENV = {
      ...TEST_ENV,
      JWKS_URL: "https://login.example.test/common/discovery/v2.0/keys",
      TOKEN_ISSUER: MULTI_ISSUER,
    }

    let multiVerify: ReturnType<typeof createTokenVerifier>

    beforeAll(() => {
      multiVerify = createTokenVerifier(readConfig(MULTI_ENV), jwksFor(key))
    })

    function tokenFor(
      tenant: string,
      claims: Record<string, unknown> = {},
    ): Promise<string> {
      return mintToken(key, {
        tid: tenant,
        iss: `https://login.example.test/${tenant}/v2.0`,
        ...claims,
      })
    }

    it("accepts a token from any home tenant", async () => {
      await expect(multiVerify(await tokenFor(OTHER_TENANT))).resolves.toEqual(
        {
          oid: "user-a",
          email: null,
          role: "user",
        },
      )
    })

    it("accepts the home tenant and a personal Microsoft account", async () => {
      await expect(multiVerify(await tokenFor(TENANT))).resolves.toMatchObject(
        { oid: "user-a" },
      )
      await expect(
        multiVerify(await tokenFor(PERSONAL_TENANT)),
      ).resolves.toMatchObject({ oid: "user-a" })
    })

    it("trusts roles only from the home tenant", async () => {
      await expect(
        multiVerify(await tokenFor(TENANT, { roles: ["admin"] })),
      ).resolves.toMatchObject({ role: "admin" })
      await expect(
        multiVerify(await tokenFor(OTHER_TENANT, { roles: ["admin"] })),
      ).resolves.toMatchObject({ role: "user" })
      await expect(
        multiVerify(await tokenFor(PERSONAL_TENANT, { roles: ["teacher"] })),
      ).resolves.toMatchObject({ role: "user" })
    })

    it("rejects a tid that is not a GUID, including the common sentinel", async () => {
      await expectRejectedFor(
        multiVerify,
        await mintToken(key, { tid: "common", iss: MULTI_ISSUER }),
      )
      await expectRejectedFor(
        multiVerify,
        await mintToken(key, {
          tid: "not-a-tenant",
          iss: "https://login.example.test/not-a-tenant/v2.0",
        }),
      )
    })

    it("rejects an issuer that disagrees with tid", async () => {
      await expectRejectedFor(
        multiVerify,
        await mintToken(key, {
          tid: TENANT,
          iss: `https://login.example.test/${OTHER_TENANT}/v2.0`,
        }),
      )
    })

    it("rejects a v1 or another-cloud issuer even when tid is a GUID", async () => {
      for (const iss of [
        `https://sts.windows.net/${OTHER_TENANT}/`,
        `https://login.microsoftonline.com/${OTHER_TENANT}/v2.0`,
      ]) {
        await expectRejectedFor(
          multiVerify,
          await mintToken(key, { tid: OTHER_TENANT, iss }),
        )
      }
    })

    it("keeps the audience, expiry, signature, scope, and oid checks", async () => {
      for (const token of [
        await tokenFor(OTHER_TENANT, { aud: "44444444-4444-4444-4444-444444444444" }),
        await tokenFor(OTHER_TENANT, { exp: NOW - 300 }),
        await tokenFor(OTHER_TENANT, { scp: "other_scope" }),
        await tokenFor(OTHER_TENANT, { oid: undefined }),
        await mintToken(otherKey, { tid: OTHER_TENANT, iss: `https://login.example.test/${OTHER_TENANT}/v2.0` }, key.kid),
      ]) {
        await expectRejectedFor(multiVerify, token)
      }
    })
  })

  it("uses the configured tenant, issuer, and audience, not constants", async () => {
    const otherConfig = {
      ...config,
      expectedTenant: "55555555-5555-5555-5555-555555555555",
    }
    const otherVerifier = createTokenVerifier(otherConfig, jwksFor(key))

    await expect(otherVerifier(await mintToken(key))).rejects.toThrow()
  })

  it("agrees with the constants the tests mint against", () => {
    expect(config).toMatchObject({
      tokenIssuer: ISSUER,
      expectedAudience: AUDIENCE,
      expectedTenant: TENANT,
    })
  })
})

describe("requireAuth", () => {
  function protectedApp() {
    let handlerCalls = 0
    const app = new Hono<AppEnv>()
    installErrorHandlers(app)
    app.use("/whoami", requireAuth(verify))
    app.all("/whoami", (c) => {
      handlerCalls += 1
      return c.json({ oid: c.get("principal").oid })
    })

    return { app, calls: () => handlerCalls }
  }

  async function request(
    app: Hono<AppEnv>,
    init: RequestInit = {},
  ): Promise<Response> {
    return app.request("/whoami", init, TEST_ENV)
  }

  it("passes the token's oid to the handler", async () => {
    const { app } = protectedApp()
    const response = await request(app, {
      headers: { Authorization: `Bearer ${await mintToken(key)}` },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ oid: "user-a" })
  })

  it("accepts a case-insensitive bearer scheme", async () => {
    const { app } = protectedApp()
    const response = await request(app, {
      headers: { Authorization: `bearer ${await mintToken(key)}` },
    })

    expect(response.status).toBe(200)
  })

  it("rejects a missing Authorization header without running the handler", async () => {
    const { app, calls } = protectedApp()
    const response = await request(app)

    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toBe("Bearer")
    expect(await response.json()).toMatchObject({
      error: { code: "unauthorized" },
    })
    expect(calls()).toBe(0)
  })

  it("rejects a non-Bearer scheme", async () => {
    const { app } = protectedApp()
    const token = await mintToken(key)

    for (const authorization of [
      `Basic ${token}`,
      "Bearer",
      "Bearer ",
      `Token ${token}`,
      token,
    ]) {
      const response = await request(app, {
        headers: { Authorization: authorization },
      })

      expect(response.status).toBe(401)
    }
  })

  it("rejects an invalid or expired token", async () => {
    const { app, calls } = protectedApp()

    for (const token of [
      "not-a-jwt",
      await mintToken(key, { exp: NOW - 300 }),
      await mintTokenForOtherTenant(key),
      mintAlgNone(),
    ]) {
      const response = await request(app, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(response.status).toBe(401)
    }

    expect(calls()).toBe(0)
  })

  it("ignores a token in the query string or a cookie", async () => {
    const { app, calls } = protectedApp()
    const token = await mintToken(key)

    const response = await request(app, {
      headers: { Cookie: `access_token=${token}` },
    })

    expect(response.status).toBe(401)
    expect(calls()).toBe(0)
  })

  it("ignores query-string tokens", async () => {
    const { app } = protectedApp()
    const token = await mintToken(key)

    const response = await app.request(
      `/whoami?access_token=${token}&oid=attacker`,
      {},
      TEST_ENV,
    )

    expect(response.status).toBe(401)
  })

  it("ignores a user id supplied in the body or another header", async () => {
    const { app } = protectedApp()
    const response = await request(app, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await mintToken(key)}`,
        "Content-Type": "application/json",
        "X-User-Id": "attacker",
        "X-Oid": "attacker",
      },
      body: JSON.stringify({ oid: "attacker", profileId: 999 }),
    })

    expect(await response.json()).toEqual({ oid: "user-a" })
  })
})
