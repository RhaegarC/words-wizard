import { describe, expect, it } from "vitest"

import { ConfigError, readConfig, type WorkerEnv } from "./config"
import { TEST_ENV } from "./test/tokens"

const REQUIRED_KEYS = [
  "JWKS_URL",
  "TOKEN_ISSUER",
  "EXPECTED_AUDIENCE",
  "EXPECTED_TENANT",
  "ALLOWED_ORIGINS",
] as const

function env(overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return { ...TEST_ENV, ...overrides }
}

function configError(run: () => unknown): ConfigError {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError)
    return error as ConfigError
  }

  throw new Error("expected readConfig to throw")
}

describe("readConfig", () => {
  it("parses every required value", () => {
    expect(readConfig(env())).toEqual({
      jwksUrl: TEST_ENV.JWKS_URL,
      tokenIssuer: TEST_ENV.TOKEN_ISSUER,
      expectedAudience: TEST_ENV.EXPECTED_AUDIENCE,
      expectedTenant: TEST_ENV.EXPECTED_TENANT,
      allowedOrigins: ["https://words.nioh.uk", "http://localhost:8443"],
    })
  })

  it("trims allowed origins and drops blank entries", () => {
    expect(
      readConfig(
        env({
          ALLOWED_ORIGINS:
            "  https://words.nioh.uk , , http://localhost:8443  ",
        }),
      ).allowedOrigins,
    ).toEqual(["https://words.nioh.uk", "http://localhost:8443"])
  })

  it("keeps the configured origin order", () => {
    expect(
      readConfig(
        env({ ALLOWED_ORIGINS: "http://localhost:8443,https://words.nioh.uk" }),
      ).allowedOrigins,
    ).toEqual(["http://localhost:8443", "https://words.nioh.uk"])
  })

  it("caches the parsed config when the values are unchanged", () => {
    expect(readConfig(env())).toBe(readConfig(env()))
  })

  it("builds a fresh config when a value changes", () => {
    const first = readConfig(env())
    const second = readConfig(env({ EXPECTED_AUDIENCE: "another-audience" }))

    expect(second).not.toBe(first)
    expect(second.expectedAudience).toBe("another-audience")
  })

  it.each(REQUIRED_KEYS)("names %s when it is missing", (key) => {
    const incomplete = { ...env() }
    delete incomplete[key]

    const error = configError(() => readConfig(incomplete))

    expect(error.key).toBe(key)
    expect(error.message).toContain(key)
    expect(error.status).toBe(500)
    expect(error.code).toBe("config_missing")
  })

  it.each(REQUIRED_KEYS)("names %s when it is blank", (key) => {
    const error = configError(() => readConfig(env({ [key]: "   " })))

    expect(error.key).toBe(key)
    expect(error.message).toContain(key)
  })

  it("rejects an origin list that holds nothing but separators", () => {
    const error = configError(() =>
      readConfig(env({ ALLOWED_ORIGINS: " , , " })),
    )

    expect(error.key).toBe("ALLOWED_ORIGINS")
  })

  it("trims a value before using it", () => {
    expect(
      readConfig(env({ JWKS_URL: "  https://login.example.test/jwks  " }))
        .jwksUrl,
    ).toBe("https://login.example.test/jwks")
  })
})
