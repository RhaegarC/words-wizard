/**
 * Account identity helpers. The profile id is the Entra `oid`; the ID token's
 * claim is the one the Worker verifies, so it is preferred over the MSAL
 * account's local id.
 */

export interface AccountLike {
  readonly localAccountId: string
  readonly idTokenClaims?: Record<string, unknown>
  readonly name?: string
  readonly username?: string
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
