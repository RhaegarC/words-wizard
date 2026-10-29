import type { MiddlewareHandler } from "hono"
import { createRemoteJWKSet, jwtVerify } from "jose"
import type { JWTVerifyGetKey } from "jose"

import type { WorkerConfig } from "./config"
import type { AppEnv, Principal } from "./context"
import { UnauthorizedError } from "./errors"

/** The delegated scope the SPA's app registration exposes to itself. */
export const ACCESS_SCOPE = "access_as_user"

const CLOCK_TOLERANCE_SECONDS = 60
const ALGORITHM = "RS256"

export type TokenVerifier = (token: string) => Promise<Principal>

/**
 * Builds the access-token verifier. `getKey` is injectable so tests can mint
 * tokens against a local key pair and never touch the network; production
 * passes nothing and gets a cached remote JWKS.
 */
export function createTokenVerifier(
  config: WorkerConfig,
  getKey?: JWTVerifyGetKey,
): TokenVerifier {
  const keys = getKey ?? createRemoteJWKSet(new URL(config.jwksUrl))

  return async (token) => {
    let payload: Record<string, unknown>

    try {
      ;({ payload } = await jwtVerify(token, keys, {
        issuer: config.tokenIssuer,
        audience: config.expectedAudience,
        algorithms: [ALGORITHM],
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        requiredClaims: ["exp", "oid", "tid", "scp"],
      }))
    } catch {
      // jose's failure reasons (bad signature, expired, wrong alg, wrong
      // issuer/audience) are all the same answer to the caller.
      throw new UnauthorizedError()
    }

    if (payload.tid !== config.expectedTenant) throw new UnauthorizedError()
    if (!hasAccessScope(payload.scp)) throw new UnauthorizedError()
    if (typeof payload.oid !== "string" || payload.oid.trim() === "") {
      throw new UnauthorizedError()
    }

    return { oid: payload.oid }
  }
}

function hasAccessScope(scp: unknown): boolean {
  return (
    typeof scp === "string" &&
    scp.split(" ").filter(Boolean).includes(ACCESS_SCOPE)
  )
}

/** `Bearer <jwt>`, case-insensitive scheme; nothing else is a credential. */
export function bearerToken(
  authorization: string | undefined,
): string | undefined {
  if (!authorization) return undefined

  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim())
  return match?.[1]
}

/**
 * Rejects the request before any handler runs. The principal is the token's
 * `oid`; no body field, path parameter, or other header is consulted.
 */
export function requireAuth(verify: TokenVerifier): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = bearerToken(c.req.header("Authorization"))
    if (!token) throw new UnauthorizedError()

    c.set("principal", await verify(token))
    await next()
  }
}
