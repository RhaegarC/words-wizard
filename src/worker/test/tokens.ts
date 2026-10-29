import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose"
import type { JWTVerifyGetKey, JWK } from "jose"

/** Values used by every verifier test; production values are configuration. */
export const TENANT = "11111111-1111-1111-1111-111111111111"
export const ISSUER = `https://login.example.test/${TENANT}/v2.0`
export const AUDIENCE = "22222222-2222-2222-2222-222222222222"
export const JWKS_URL = "https://login.example.test/jwks"
export const ACCESS_SCOPE = "access_as_user"

export const TEST_ENV = {
  JWKS_URL,
  TOKEN_ISSUER: ISSUER,
  EXPECTED_AUDIENCE: AUDIENCE,
  EXPECTED_TENANT: TENANT,
  ALLOWED_ORIGINS: "https://words.nioh.uk,http://localhost:8443",
} as const

export interface TestKey {
  readonly kid: string
  readonly privateKey: CryptoKey
  readonly jwk: JWK
}

export async function createTestKey(kid = "test-key"): Promise<TestKey> {
  const { privateKey, publicKey } = await generateKeyPair("RS256")
  const jwk = await exportJWK(publicKey)

  return {
    kid,
    privateKey,
    jwk: { ...jwk, kid, alg: "RS256", use: "sig" },
  }
}

/** A verifier key source backed by the locally minted keys, never the network. */
export function jwksFor(...keys: readonly TestKey[]): JWTVerifyGetKey {
  return createLocalJWKSet({ keys: keys.map((key) => key.jwk) })
}

export function defaultClaims(
  nowSeconds = Math.floor(Date.now() / 1000),
): Record<string, unknown> {
  return {
    oid: "user-a",
    tid: TENANT,
    scp: ACCESS_SCOPE,
    iss: ISSUER,
    aud: AUDIENCE,
    iat: nowSeconds - 10,
    nbf: nowSeconds - 10,
    exp: nowSeconds + 3600,
  }
}

export async function mintToken(
  key: TestKey,
  claims: Record<string, unknown> = {},
  kid = key.kid,
): Promise<string> {
  return new SignJWT({ ...defaultClaims(), ...claims })
    .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
    .sign(key.privateKey)
}

/** An HS256 token: the verifier pins RS256, so this must never be accepted. */
export async function mintHs256(
  claims: Record<string, unknown> = {},
): Promise<string> {
  const secret = new TextEncoder().encode("not-a-real-secret")
  return new SignJWT({ ...defaultClaims(), ...claims })
    .setProtectedHeader({ alg: "HS256", kid: "test-key", typ: "JWT" })
    .sign(secret)
}

/** A structurally valid token with `alg: none` and an empty signature. */
export function mintAlgNone(claims: Record<string, unknown> = {}): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")

  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    ...defaultClaims(),
    ...claims,
  })}.`
}

export async function mintTokenForOtherTenant(
  key: TestKey,
  tenant = "33333333-3333-3333-3333-333333333333",
): Promise<string> {
  const iss = `https://login.example.test/${tenant}/v2.0`
  return mintToken(key, { tid: tenant, iss })
}
