import type { AccountInfo } from "@azure/msal-browser"

/**
 * Account identity helpers. The profile id is the Entra `oid`; the ID token's
 * claim is the one the Worker verifies, so it is preferred over the MSAL
 * account's local id.
 */

export interface AccountLike {
  readonly localAccountId: string
  /**
   * The fields below are not needed by the UI, but MSAL derives the token
   * cache key from them; dropping them makes `acquireTokenSilent` unable to
   * find the credentials the redirect just stored.
   */
  readonly homeAccountId?: string
  readonly environment?: string
  readonly tenantId?: string
  readonly idTokenClaims?: Record<string, unknown>
  readonly name?: string
  readonly username?: string
}

/**
 * Narrow a MSAL account to the shape the app passes around. The cache-key
 * fields are kept deliberately: `acquireTokenSilent` builds its lookup from
 * `homeAccountId`, `environment`, and `tenantId`, and a partial account makes
 * the SDK throw rather than renew silently.
 */
export function toAccountLike(account: AccountInfo | null): AccountLike | null {
  if (account === null) {
    return null
  }

  return {
    localAccountId: account.localAccountId,
    homeAccountId: account.homeAccountId,
    environment: account.environment,
    tenantId: account.tenantId,
    idTokenClaims: (account.idTokenClaims ?? undefined) as
      | Record<string, unknown>
      | undefined,
    name: account.name,
    username: account.username,
  }
}

export function accountOid(account: AccountLike | null): string | null {
  if (account === null) {
    return null
  }

  const claim = account.idTokenClaims?.oid

  if (typeof claim === "string" && claim.trim() !== "") {
    return claim
  }

  return account.localAccountId.trim() === "" ? null : account.localAccountId
}

export function accountDisplayName(account: AccountLike | null): string {
  if (account === null) {
    return ""
  }

  return account.name?.trim() || account.username?.trim() || ""
}
