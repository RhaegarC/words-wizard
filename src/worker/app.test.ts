import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createApp } from "./app"
import { installErrorHandlers } from "./errors"
import type { AppEnv } from "./context"
import { TEST_ENV } from "./test/tokens"

function app() {
  return createApp()
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("database-backed routes", () => {
  // The 200 shapes are asserted by the host tier, where a real D1 database is
  // migrated and booted. Offline, the claim worth making is that a route which
  // needs the database refuses to answer without the binding.
  it("fails GET /health with config_missing when the DB binding is absent", async () => {
    const response = await app().request("/health", {}, TEST_ENV)

    expect(response.status).toBe(500)
    expect(await json(response)).toMatchObject({
      error: {
        code: "config_missing",
        message: expect.stringContaining("DB"),
      },
    })
  })

  it("fails GET /v1/content with config_missing when the DB binding is absent", async () => {
    const response = await app().request("/v1/content", {}, TEST_ENV)

    expect(response.status).toBe(500)
    expect(await json(response)).toMatchObject({
      error: {
        code: "config_missing",
        message: expect.stringContaining("DB"),
      },
    })
  })

  it("returns JSON", async () => {
    const response = await app().request("/health", {}, TEST_ENV)

    expect(response.headers.get("content-type")).toContain("application/json")
  })
})

describe("user routes", () => {
  const routes: Array<[string, string]> = [
    ["GET", "/v1/me"],
    ["POST", "/v1/me/profile"],
    ["PATCH", "/v1/me/profile"],
    ["POST", "/v1/me/sessions"],
    ["POST", "/v1/me/metrics"],
    ["POST", "/v1/me/care"],
  ]

  it("answers 401 before touching the database when no token is sent", async () => {
    for (const [method, path] of routes) {
      const response = await app().request(path, { method }, TEST_ENV)
      const body = (await response.json()) as { error: { code: string } }

      expect(response.status, path).toBe(401)
      expect(body.error.code).toBe("unauthorized")
    }
  })

  it("answers 405 to a known user path with an unaccepted method", async () => {
    const authenticated = createApp({
      verifierFor: () => async () => ({ oid: "user-a" }),
    })
    const response = await authenticated.request(
      "/v1/me/profile",
      { method: "DELETE", headers: { Authorization: "Bearer token" } },
      TEST_ENV,
    )

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("POST, PATCH")
  })
})

describe("errors", () => {
  it("returns a 404 envelope for an unknown route", async () => {
    const response = await app().request("/v1/nope", {}, TEST_ENV)

    expect(response.status).toBe(404)
    expect(await json(response)).toEqual({
      error: {
        code: "not_found",
        message: expect.any(String),
      },
    })
  })

  it("returns a 405 envelope for a known path with the wrong method", async () => {
    const response = await app().request(
      "/health",
      { method: "POST" },
      TEST_ENV,
    )

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("GET")
    expect(await json(response)).toMatchObject({
      error: { code: "method_not_allowed" },
    })
  })

  it("fails with 500 config_missing and names the key in the log", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    const incomplete = { ...TEST_ENV, EXPECTED_TENANT: "" }

    const response = await app().request("/health", {}, incomplete)

    expect(response.status).toBe(500)
    expect(await json(response)).toMatchObject({
      error: {
        code: "config_missing",
        message: expect.stringContaining("EXPECTED_TENANT"),
      },
    })
    expect(logged).toHaveBeenCalled()
    expect(logged.mock.calls.flat().map(String).join(" ")).toContain(
      "EXPECTED_TENANT",
    )
  })

  it("turns an unexpected exception into a generic 500", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    const faulty = new Hono<AppEnv>()
    installErrorHandlers(faulty)
    faulty.get("/boom", () => {
      throw new Error("database exploded: secret-value")
    })

    const response = await faulty.request("/boom", {}, TEST_ENV)
    const body = await json(response)

    expect(response.status).toBe(500)
    expect(body).toEqual({
      error: { code: "internal", message: "Internal server error." },
    })
    expect(JSON.stringify(body)).not.toContain("secret-value")
    expect(logged).toHaveBeenCalled()
  })

  it("maps every envelope to a stable code and a safe message", async () => {
    const responses = [
      await app().request("/v1/nope", {}, TEST_ENV),
      await app().request("/health", { method: "DELETE" }, TEST_ENV),
    ]

    for (const response of responses) {
      const body = (await json(response)) as {
        error: Record<string, string>
      }

      expect(Object.keys(body)).toEqual(["error"])
      expect(Object.keys(body.error).sort()).toEqual(["code", "message"])
      expect(body.error.code).toMatch(/^[a-z_]+$/)
      expect(body.error.message).not.toMatch(/stack|Error:/i)
    }
  })
})
