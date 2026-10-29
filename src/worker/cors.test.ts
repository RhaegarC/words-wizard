import { describe, expect, it } from "vitest"

import { createApp } from "./app"
import { TEST_ENV } from "./test/tokens"

const ALLOWED = "https://words.nioh.uk"
const LOCAL = "http://localhost:8443"
const UNLISTED = "https://evil.test"

function app() {
  return createApp()
}

describe("CORS", () => {
  it("echoes an allowed origin", async () => {
    const response = await app().request(
      "/health",
      { headers: { Origin: ALLOWED } },
      TEST_ENV,
    )

    expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED)
  })

  it("allows the local development origin", async () => {
    const response = await app().request(
      "/health",
      { headers: { Origin: LOCAL } },
      TEST_ENV,
    )

    expect(response.headers.get("access-control-allow-origin")).toBe(LOCAL)
  })

  it("sends no allow-origin for an unlisted origin", async () => {
    const response = await app().request(
      "/health",
      { headers: { Origin: UNLISTED } },
      TEST_ENV,
    )

    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })

  it("does not treat a prefix or a trailing slash as the listed origin", async () => {
    for (const origin of [
      "https://words.nioh.uk.evil.test",
      "https://words.nioh.uk/",
      "http://words.nioh.uk",
    ]) {
      const response = await app().request(
        "/health",
        { headers: { Origin: origin } },
        TEST_ENV,
      )

      expect(response.headers.get("access-control-allow-origin")).toBeNull()
    }
  })

  it("never uses a wildcard", async () => {
    const response = await app().request(
      "/health",
      { headers: { Origin: ALLOWED } },
      TEST_ENV,
    )

    expect(response.headers.get("access-control-allow-origin")).not.toBe("*")
  })

  it("varies on Origin", async () => {
    const response = await app().request("/health", {}, TEST_ENV)

    expect(response.headers.get("vary")).toContain("Origin")
  })

  it("answers an allowed preflight with 204 and no credential allowance", async () => {
    const response = await app().request(
      "/health",
      { method: "OPTIONS", headers: { Origin: ALLOWED } },
      TEST_ENV,
    )

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED)
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET,POST,PATCH,OPTIONS",
    )
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Authorization, Content-Type, If-None-Match",
    )
    expect(response.headers.get("access-control-max-age")).toBeTruthy()
    expect(response.headers.get("access-control-allow-credentials")).toBeNull()
  })

  it("does not require a token for a preflight", async () => {
    const response = await app().request(
      "/v1/me",
      { method: "OPTIONS", headers: { Origin: ALLOWED } },
      TEST_ENV,
    )

    expect(response.status).toBe(204)
  })

  it("answers an unlisted preflight with 204 and no CORS headers", async () => {
    const response = await app().request(
      "/health",
      { method: "OPTIONS", headers: { Origin: UNLISTED } },
      TEST_ENV,
    )

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
    expect(response.headers.get("access-control-allow-methods")).toBeNull()
  })
})
