import type { MiddlewareHandler } from "hono"
import { createRemoteJWKSet, jwtVerify } from "jose"
import type { JWTVerifyGetKey } from "jose"

import type { Role } from "../shared/types"
import { MULTI_TENANT_AUTHORITY, isTenantId } from "./config"
import type { WorkerConfig } from "./config"
import type { AppEnv, Principal } from "./context"
import { ForbiddenError, UnauthorizedError } from "./errors"

/** The delegated scope the SPA's app registration exposes to itself. */
export const ACCESS_SCOPE = "access_as_user"

const CLOCK_TOLERANCE_SECONDS = 60
const ALGORITHM = "RS256"

/** The authority segment a multi-tenant issuer template carries. */
const AUTHORITY_SEGMENT = new RegExp(`/${MULTI_TENANT_AUTHORITY}/`, "i")

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
        // A token accepted by the common authority names the account's own
        // home tenant as its issuer. The exact value depends on `tid`, so it
        // is checked below; the template only says where sign-in was routed.
        ...(config.multiTenant ? {} : { issuer: config.tokenIssuer }),
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

    if (config.multiTenant) {
      // The issuer must be the configured authority with the token's own
      // tenant in place of `common`, so a token cannot claim one tenant's id
      // while another tenant issued it.
      if (!isTenantId(payload.tid)) throw new UnauthorizedError()
      if (payload.iss !== issuerForTenant(config.tokenIssuer, payload.tid)) {
        throw new UnauthorizedError()
      }
    } else if (payload.tid !== config.expectedTenant) {
      throw new UnauthorizedError()
    }

    if (!hasAccessScope(payload.scp)) throw new UnauthorizedError()
    if (typeof payload.oid !== "string" || payload.oid.trim() === "") {
      throw new UnauthorizedError()
    }

    return {
      oid: payload.oid,
      email: emailClaim(payload),
      // App roles are assigned by the tenant that issues the token. Only the
      // home tenant is ours to trust; another tenant's administrator must not
      // be able to grant this application's `teacher` or `admin` role.
      role:
        payload.tid === config.expectedTenant
          ? roleClaim(payload.roles)
          : "user",
    }
  }
}

/** `https://…/common/v2.0` plus a tenant becomes `https://…/<tenant>/v2.0`. */
function issuerForTenant(template: string, tenant: string): string {
  return template.replace(AUTHORITY_SEGMENT, `/${tenant}/`)
}

/**
 * Entra emits either claim depending on the account and flow. An address is
 * stored, never cleared: a later token without one leaves the stored value.
 */
function emailClaim(payload: Record<string, unknown>): string | null {
  return usableText(payload.email) ?? usableText(payload.preferred_username)
}
function usableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}
/** `admin` outranks `teacher`, which outranks the default `user`. */
function roleClaim(roles: unknown): Role {
  if (!Array.isArray(roles)) return "user"
  if (roles.includes("admin")) return "admin"
  if (roles.includes("teacher")) return "teacher"
  return "user"
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

/**
 * Runs after `requireAuth` and refuses a verified caller whose token role is
 * not in the allowlist. The role is the one the verifier copied from the
 * token; `profiles.role` is never consulted, so a stale database row cannot
 * grant access.
 */
export function requireRole(
  allowed: readonly Role[],
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const principal: Principal | undefined = c.get("principal")
    if (principal === undefined) throw new UnauthorizedError()
    if (!allowed.includes(principal.role)) throw new ForbiddenError()

    await next()
  }
}
