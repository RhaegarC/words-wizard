import type { AccountInfo, PublicClientApplication } from "@azure/msal-browser"

import { toAccountLike, type AccountLike } from "../page/auth/account"
import {
  AuthConfigError,
  authConfigFromEnv,
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

export type PortalConfigResult =
  | { readonly config: AuthConfig; readonly error: null }
  | { readonly config: null; readonly error: string }

export function readPortalConfig(env?: AuthEnv): PortalConfigResult {
  try {
    return { config: authConfigFromEnv(env), error: null }
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
