import type { AccountLike } from "./account"

/**
 * Token acquisition, separated from MSAL so the rule is unit-testable: silent
 * first, then one redirect — never a popup, never a client secret.
 */

export interface SilentRequest {
  readonly account: AccountLike
  readonly scopes: readonly string[]
  readonly forceRefresh?: boolean
}

export interface RedirectRequest {
  readonly account: AccountLike
  readonly scopes: readonly string[]
}

export interface TokenSource {
  getActiveAccount(): AccountLike | null
  acquireTokenSilent(request: SilentRequest): Promise<{ accessToken: string }>
  acquireTokenRedirect(request: RedirectRequest): Promise<void>
}

/** Nobody is signed in; the caller routes to `#/signin`. */
export class NoAccountError extends Error {
  constructor() {
    super("No signed-in account")
    this.name = "NoAccountError"
  }
}

/** A redirect is in progress; the current request cannot finish. */
export class RedirectingError extends Error {
  constructor() {
    super("Redirecting to sign in")
    this.name = "RedirectingError"
  }
}

export type TokenGetter = (options?: {
  forceRefresh?: boolean
}) => Promise<string>

export function createTokenGetter(
  source: TokenSource,
  scopes: readonly string[],
): TokenGetter {
  return async (options = {}) => {
    const account = source.getActiveAccount()

    if (account === null) {
      throw new NoAccountError()
    }

    try {
      const result = await source.acquireTokenSilent({
        account,
        scopes,
        forceRefresh: options.forceRefresh,
      })

      return result.accessToken
    } catch (error) {
      if (isInteractionRequired(error)) {
        await source.acquireTokenRedirect({ account, scopes })
        throw new RedirectingError()
      }

      throw error
    }
  }
}

/**
 * MSAL signals "the cache cannot satisfy this silently" with this class. The
 * name check keeps this module free of a runtime dependency on the SDK.
 */
function isInteractionRequired(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "InteractionRequiredAuthError"
  )
}
