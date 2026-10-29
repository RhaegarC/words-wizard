import { ConfigError } from "./errors"

export { ConfigError }

/** The non-secret values wrangler binds to the Worker. */
export interface WorkerEnv {
  JWKS_URL?: string | undefined
  TOKEN_ISSUER?: string | undefined
  EXPECTED_AUDIENCE?: string | undefined
  EXPECTED_TENANT?: string | undefined
  ALLOWED_ORIGINS?: string | undefined
}

/** Validated configuration; handlers never read `WorkerEnv` directly. */
export interface WorkerConfig {
  readonly jwksUrl: string
  readonly tokenIssuer: string
  readonly expectedAudience: string
  readonly expectedTenant: string
  readonly allowedOrigins: readonly string[]
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

  const config: WorkerConfig = Object.freeze({
    jwksUrl,
    tokenIssuer,
    expectedAudience,
    expectedTenant,
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
