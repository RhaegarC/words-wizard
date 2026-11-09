import type { D1Database } from "./db/d1"
import { ConfigError } from "./errors"

import type { R2Bucket } from "./r2"
export { ConfigError }

/** The bindings wrangler provides: non-secret vars plus the D1 database. */
export interface WorkerEnv {
  JWKS_URL?: string | undefined
  TOKEN_ISSUER?: string | undefined
  EXPECTED_AUDIENCE?: string | undefined
  EXPECTED_TENANT?: string | undefined
  ALLOWED_ORIGINS?: string | undefined
  DB?: D1Database | undefined
  AVATARS?: R2Bucket | undefined
  WORD_IMAGES?: R2Bucket | undefined
}

/** Validated configuration; handlers never read `WorkerEnv` directly. */
export interface WorkerConfig {
  readonly jwksUrl: string
  readonly tokenIssuer: string
  readonly expectedAudience: string
  /** The home tenant; only its `roles` claim is trusted. */
  readonly expectedTenant: string
  /** True when `tokenIssuer` names the shared authority, not one tenant. */
  readonly multiTenant: boolean
  readonly allowedOrigins: readonly string[]
}

/**
 * The authority that accepts any Entra tenant and personal Microsoft accounts.
 * In that mode the token's own `tid` replaces this segment of the issuer.
 */
export const MULTI_TENANT_AUTHORITY = "common"

const MULTI_TENANT_ISSUER_PATTERN = new RegExp(
  `/${MULTI_TENANT_AUTHORITY}/v2\\.0$`,
  "i",
)
const MULTI_TENANT_JWKS_PATTERN = new RegExp(`/${MULTI_TENANT_AUTHORITY}/`, "i")
const TENANT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** An Entra tenant id is a GUID; `common` is an authority, not a tenant. */
export function isTenantId(value: unknown): value is string {
  return typeof value === "string" && TENANT_ID_PATTERN.test(value)
}

const REQUIRED_KEYS = [
  "JWKS_URL",
  "TOKEN_ISSUER",
  "EXPECTED_AUDIENCE",
  "EXPECTED_TENANT",
  "ALLOWED_ORIGINS",
] as const

type RequiredKey = typeof REQUIRED_KEYS[number]

/**
 * Parsed once per isolate for the values it was built from. Keying the cache
 * on the values (not on identity) keeps the production read free while still
 * letting tests exercise different configurations in one process.
 */
let cached: {
  readonly signature: string
  readonly config: WorkerConfig
} | undefined

export function readConfig(env: WorkerEnv): WorkerConfig {
  const signature = REQUIRED_KEYS.map((key) => env[key] ?? "").join("\u0000")
  if (cached?.signature === signature) return cached.config

  const jwksUrl = required(env.JWKS_URL, "JWKS_URL")
  const tokenIssuer = required(env.TOKEN_ISSUER, "TOKEN_ISSUER")
  const expectedAudience = required(env.EXPECTED_AUDIENCE, "EXPECTED_AUDIENCE")
  const expectedTenant = required(env.EXPECTED_TENANT, "EXPECTED_TENANT")
  const allowedOrigins = parseOrigins(
    required(env.ALLOWED_ORIGINS, "ALLOWED_ORIGINS"),
  )

  const multiTenant = MULTI_TENANT_ISSUER_PATTERN.test(tokenIssuer)

  if (multiTenant) {
    // `common` is not a tenant: the home tenant stays in EXPECTED_TENANT, and
    // it remains the only tenant whose roles are trusted.
    if (!isTenantId(expectedTenant)) {
      throw new ConfigError(
        "EXPECTED_TENANT",
        "Invalid (must be the home tenant id)",
      )
    }

    // A tenant-specific key set cannot verify a token issued for another
    // tenant. Refusing the pairing turns the bug this mode fixes into a
    // startup error instead of a 401 for every foreign account.
    if (!MULTI_TENANT_JWKS_PATTERN.test(jwksUrl)) {
      throw new ConfigError(
        "JWKS_URL",
        'Invalid (a "common" issuer needs the shared key set)',
      )
    }
  }

  const config: WorkerConfig = Object.freeze({
    jwksUrl,
    tokenIssuer,
    expectedAudience,
    expectedTenant,
    multiTenant,
    allowedOrigins: Object.freeze(allowedOrigins),
  })

  cached = { signature, config }
  return config
}

function required(value: string | undefined, key: RequiredKey): string {
  const trimmed = value?.trim()
  if (!trimmed) throw new ConfigError(key)
  return trimmed
}

/**
 * The D1 binding. A route that reaches the database asks for it here rather
 * than reading `env.DB` directly, so a missing binding is the same
 * `config_missing` failure as a missing var.
 */
export function requireDb(env: WorkerEnv): D1Database {
  if (env.DB === undefined) throw new ConfigError("DB")
  return env.DB
}

/** The R2 binding for uploaded avatars; same missing-binding failure as D1. */
export function requireAvatars(env: WorkerEnv): R2Bucket {
  if (env.AVATARS === undefined) throw new ConfigError("AVATARS")
  return env.AVATARS
}

/**
 * The R2 binding for word pictures. A bucket of its own, deliberately separate
 * from the avatars: the two stores have different owners, keys, and lifetimes.
 */
export function requireWordImages(env: WorkerEnv): R2Bucket {
  if (env.WORD_IMAGES === undefined) throw new ConfigError("WORD_IMAGES")
  return env.WORD_IMAGES
}

function parseOrigins(value: string): string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

  // An allowlist that resolves to nothing is a configuration failure, not a
  // permissive default.
  if (origins.length === 0) throw new ConfigError("ALLOWED_ORIGINS")
  return origins
}
