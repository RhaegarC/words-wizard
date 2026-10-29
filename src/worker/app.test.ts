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

describe("GET /health", () => {
  it("answers 200 without authentication", async () => {
    const response = await app().request("/health", {}, TEST_ENV)

    expect(response.status).toBe(200)
    expect(await json(response)).toEqual({ ok: true })
  })

  it("is never cached", async () => {
    const response = await app().request("/health", {}, TEST_ENV)

    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("returns JSON", async () => {
    const response = await app().request("/health", {}, TEST_ENV)

    expect(response.headers.get("content-type")).toContain("application/json")
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
