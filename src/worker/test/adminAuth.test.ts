import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { createApp } from "../app"
import type { AppEnv } from "../context"
import { installErrorHandlers } from "../errors"
import { TEST_ENV } from "./tokens"

/**
 * The admin authorization boundary (feature 28). Every claim here is decided
 * offline: the verifier is injected, so a role is the only thing that changes
 * between a refusal and a pass, and no database is opened.
 */

const ADMIN_ROUTES = ["/v1/admin/content", "/v1/admin/access"] as const

type TestRole = "user" | "teacher" | "admin"

function appFor(role: TestRole) {
  return createApp({
    verifierFor: () => async () => ({
      oid: "admin-test-user",
      email: "staff@example.test",
      role,
    }),
  })
}

function bearer(): Record<string, string> {
  return { Authorization: "Bearer token" }
}

async function body(response: Response): Promise<{
  error?: { code?: string; message?: string }
  role?: string
}> {
  return (await response.json()) as {
    error?: { code?: string; message?: string }
    role?: string
  }
}

describe("anonymous callers", () => {
  it("answers 401 on every admin route before touching the database", async () => {
    for (const path of ADMIN_ROUTES) {
      const response = await createApp().request(path, {}, TEST_ENV)
      const payload = await body(response)

      expect(response.status, path).toBe(401)
      expect(payload.error?.code).toBe("unauthorized")
      expect(response.headers.get("cache-control")).toBe("no-store")
    }
  })
})

describe("a signed-in user role", () => {
  it("answers 403 on every admin route", async () => {
    for (const path of ADMIN_ROUTES) {
      const response = await appFor("user").request(
        path,
        { headers: bearer() },
        TEST_ENV,
      )
      const payload = await body(response)

      expect(response.status, path).toBe(403)
      expect(payload.error?.code).toBe("forbidden")
      expect(response.headers.get("cache-control")).toBe("no-store")
    }
  })

  it("is refused before the database binding is consulted", async () => {
    // TEST_ENV carries no DB binding; a request that reached the handler would
    // fail 500 config_missing instead of 403.
    const response = await appFor("user").request(
      "/v1/admin/content",
      { headers: bearer() },
      TEST_ENV,
    )

    expect(response.status).toBe(403)
    expect((await body(response)).error?.code).toBe("forbidden")
  })
})

describe("staff roles", () => {
  it("lets a teacher read the access record", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/access",
      { headers: bearer() },
      TEST_ENV,
    )

    expect(response.status).toBe(200)
    expect(await body(response)).toEqual({ role: "teacher" })
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("lets an admin read the access record", async () => {
    const response = await appFor("admin").request(
      "/v1/admin/access",
      { headers: bearer() },
      TEST_ENV,
    )

    expect(response.status).toBe(200)
    expect(await body(response)).toEqual({ role: "admin" })
  })

  it("lets a teacher past the gate to the content handler", async () => {
    // No DB binding: reaching the handler is what 500 config_missing proves.
    const response = await appFor("teacher").request(
      "/v1/admin/content",
      { headers: bearer() },
      TEST_ENV,
    )
    const payload = await body(response)

    expect(response.status).toBe(500)
    expect(payload.error?.code).toBe("config_missing")
    expect(payload.error?.message).toContain("DB")
  })
})

describe("method handling", () => {
  it("answers 405 with Allow for a known admin path", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/access",
      { method: "POST", headers: bearer() },
      TEST_ENV,
    )

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("GET")
    expect((await body(response)).error?.code).toBe("method_not_allowed")
  })

  it("matches a parameterised route so a wrong method is 405, not 404", async () => {
    const app = new Hono<AppEnv>()
    app.patch("/v1/admin/topics/:id", (c) => c.body(null, 204))
    installErrorHandlers(app, { "/v1/admin/topics/:id": ["PATCH"] })

    const response = await app.request("/v1/admin/topics/topic-a", {
      method: "DELETE",
    })

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("PATCH")
  })

  it("does not let a parameter match more than one segment", async () => {
    const app = new Hono<AppEnv>()
    app.patch("/v1/admin/topics/:id", (c) => c.body(null, 204))
    installErrorHandlers(app, { "/v1/admin/topics/:id": ["PATCH"] })

    const response = await app.request("/v1/admin/topics/topic-a/extra", {
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })
})
