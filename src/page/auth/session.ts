import type { AuthConfig } from "./config"

/**
 * The redirect half of the browser session, separated from React and MSAL so
 * the rule is unit-testable.
 *
 * Two things here are load-bearing:
 *
 * - `handleRedirectPromise` runs exactly once per page load. React StrictMode
 *   mounts the provider's effect twice, and a second MSAL client would race
 *   the first over the same authorization code and request cache — the loser
 *   clears the hash and resolves `null`, leaving the app signed out with a
 *   perfectly good response already consumed.
 * - It is asked not to navigate to the page that started sign-in. The app's
 *   only signed-out route is `#/signin`, the guard sends a signed-in user to
 *   `#/create` or `#/home`, and MSAL's default navigation cannot see its own
 *   response through the app's hash routes — it caches the response and takes
 *   another full page load to process it.
 */

/** The slice of `PublicClientApplication` the redirect rule needs. */
export interface MsalSessionClient<Account> {
  initialize(): Promise<void>
  handleRedirectPromise(
    request?: RedirectOptions,
  ): Promise<{ account?: Account | null } | null>
  getActiveAccount(): Account | null
  getAllAccounts(): Account[]
  setActiveAccount(account: Account): void
}

export interface RedirectOptions {
  readonly navigateToLoginRequestUrl?: boolean
}

export interface Session<Account> {
  readonly client: MsalSessionClient<Account>
  /** Resolves the signed-in account, or null when nobody is signed in. */
  readonly ready: Promise<Account | null>
}

/** Apply a returning redirect, then fall back to whatever the cache holds. */
export async function restoreSession<Account>(
  client: MsalSessionClient<Account>,
): Promise<Account | null> {
  await client.initialize()

  const result = await client.handleRedirectPromise({
    navigateToLoginRequestUrl: false,
  })
  const account =
    result?.account ??
    client.getActiveAccount() ??
    client.getAllAccounts()[0] ??
    null

  if (account !== null) {
    client.setActiveAccount(account)
  }

  return account
}

/**
 * One session per config for the lifetime of the module. Repeated calls — the
 * second StrictMode mount, a re-render that re-runs the effect — await the
 * same initialization instead of starting a second one.
 */
export function createSessionLoader<Account>(
  createClient: (config: AuthConfig) => MsalSessionClient<Account>,
): (config: AuthConfig) => Session<Account> {
  let cached: { key: string; session: Session<Account> } | null = null

  return (config) => {
    const key = configKey(config)

    if (cached === null || cached.key !== key) {
      const client = createClient(config)

      cached = { key, session: { client, ready: restoreSession(client) } }
    }

    return cached.session
  }
}

/**
 * The fields that make two configs the same app. Compared by value so a
 * re-created object (a double render, a reload of the same env) does not start
 * a second client over the same redirect response.
 */
function configKey(config: AuthConfig): string {
  return [
    config.clientId,
    config.tenantId,
    config.authority,
    config.redirectUri,
    config.postLogoutRedirectUri,
    config.apiBaseUrl,
    config.scopes.join(" "),
  ].join("|")
}
