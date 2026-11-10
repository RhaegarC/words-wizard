import type { AccountInfo, PublicClientApplication } from "@azure/msal-browser"

import { toAccountLike, type AccountLike } from "../page/auth/account"
import {
  AuthConfigError,
  readAuthConfig,
  type AuthConfig,
  type AuthEnv,
} from "../page/auth/config"
import { createMsal } from "../page/auth/msal"
import { createSessionLoader } from "../page/auth/session"
import { createTokenGetter, type TokenGetter } from "../page/auth/token"

/**
 * The portal's thin glue over the child app's pure auth modules. It imports
 * no provider, content store, or API client from `src/page`: the portal is a
 * separate application that happens to share one Entra registration.
 */

export { AuthConfigError }
export type { AccountLike, AuthConfig, TokenGetter }

/**
 * The portal is single-tenant. Unlike the child app, it may not use the
 * multi-tenant `common` authority: only a member of the home tenant can hold
 * the teacher/admin app roles the Worker trusts.
 */
export const PORTAL_TENANT_ENV_KEY = "VITE_PORTAL_ENTRA_TENANT_ID"

export type PortalAuthEnv = AuthEnv &
  Partial<Record<typeof PORTAL_TENANT_ENV_KEY, string | undefined>>

export type PortalConfigResult =
  | { readonly config: AuthConfig; readonly error: null }
  | { readonly config: null; readonly error: string }

const TENANT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function readPortalConfig(
  env?: PortalAuthEnv,
  origin: string = window.location.origin,
): PortalConfigResult {
  try {
    const values = env ?? (import.meta.env as PortalAuthEnv)
    const tenantId = values[PORTAL_TENANT_ENV_KEY]?.trim()

    if (tenantId === undefined || tenantId === "") {
      throw new AuthConfigError(PORTAL_TENANT_ENV_KEY)
    }

    // `common`, `organizations`, and `consumers` are authorities, not tenants:
    // allowing one would admit accounts the staff gate can never authorize.
    if (!TENANT_ID_PATTERN.test(tenantId)) {
      throw new AuthConfigError(
        PORTAL_TENANT_ENV_KEY,
        "Invalid (must be the home tenant id)",
      )
    }

    return {
      config: readAuthConfig(
        { ...values, VITE_ENTRA_TENANT_ID: tenantId },
        origin,
      ),
      error: null,
    }
  } catch (error) {
    if (error instanceof AuthConfigError) {
      return { config: null, error: error.key }
    }

    return { config: null, error: "unknown" }
  }
}

/** One MSAL client and one redirect handling per page load, like the child app. */
export const loadPortalSession = createSessionLoader((config) => createMsal(config))

export function tokenGetterFor(
  msal: PublicClientApplication,
  config: AuthConfig,
): TokenGetter {
  return createTokenGetter(
    {
      getActiveAccount: () => toAccountLike(msal.getActiveAccount()),
      acquireTokenSilent: (request) =>
        msal.acquireTokenSilent({
          account: request.account as AccountInfo,
          scopes: [...request.scopes],
          forceRefresh: request.forceRefresh,
        }),
      acquireTokenRedirect: async (request) => {
        await msal.acquireTokenRedirect({
          account: request.account as AccountInfo,
          scopes: [...request.scopes],
        })
      },
    },
    config.scopes,
  )
}
