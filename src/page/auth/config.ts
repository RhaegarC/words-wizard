/**
 * Build-time Entra configuration. A missing value stops boot with a named
 * error rather than rendering a sign-in button that cannot work.
 *
 * There is no client secret: this is a public browser application, and the
 * scope is the API's `access_as_user`.
 */

export const AUTH_ENV_KEYS = [
  "VITE_ENTRA_CLIENT_ID",
  "VITE_ENTRA_TENANT_ID",
  "VITE_ENTRA_SCOPE",
  "VITE_API_BASE_URL",
] as const

export type AuthEnvKey = (typeof AUTH_ENV_KEYS)[number]

export type AuthEnv = Partial<Record<AuthEnvKey, string | undefined>>

export interface AuthConfig {
  readonly clientId: string
  readonly tenantId: string
  readonly apiBaseUrl: string
  readonly authority: string
  readonly redirectUri: string
  readonly postLogoutRedirectUri: string
  readonly scopes: readonly string[]
}

export class AuthConfigError extends Error {
  constructor(readonly key: AuthEnvKey) {
    super(`Missing or blank configuration: ${key}`)
    this.name = "AuthConfigError"
  }
}

export function readAuthConfig(
  env: AuthEnv,
  origin: string,
): AuthConfig {
  const value = (key: AuthEnvKey): string => {
    const raw = env[key]?.trim()

    if (raw === undefined || raw === "") {
      throw new AuthConfigError(key)
    }

    return raw
  }

  const clientId = value("VITE_ENTRA_CLIENT_ID")
  const tenantId = value("VITE_ENTRA_TENANT_ID")
  const scope = value("VITE_ENTRA_SCOPE")
  const apiBaseUrl = value("VITE_API_BASE_URL").replace(/\/+$/, "")
  const redirectUri = `${origin.replace(/\/+$/, "")}/`

  return {
    clientId,
    tenantId,
    apiBaseUrl,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
    scopes: ["openid", "profile", scope],
  }
}

/** The app reads `import.meta.env`; tests pass their own object. */
export function authConfigFromEnv(
  env: AuthEnv = import.meta.env as AuthEnv,
): AuthConfig {
  return readAuthConfig(env, window.location.origin)
}
