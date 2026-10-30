import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { AccountInfo, PublicClientApplication } from "@azure/msal-browser"

import { clearContent } from "../content"
import { configureProgressProvider } from "../api/provider"
import { Outbox } from "../api/outbox"
import { accountDisplayName, accountOid, type AccountLike } from "./account"
import {
  AuthConfigError,
  authConfigFromEnv,
  type AuthConfig,
} from "./config"
import { createMsal } from "./msal"
import {
  NoAccountError,
  createTokenGetter,
  type TokenGetter,
} from "./token"

/**
 * The browser session. Screens never touch MSAL: they ask this context for the
 * signed-in account, a token getter, and the two redirects.
 */

export type AuthStatus = "loading" | "signed-out" | "signed-in" | "error"

export interface AuthContextValue {
  readonly status: AuthStatus
  readonly account: AccountLike | null
  /** The Entra `oid`, or null while signed out. */
  readonly oid: string | null
  readonly displayName: string
  readonly config: AuthConfig | null
  /** Present only when build-time configuration is incomplete. */
  readonly configError: AuthConfigError | null
  readonly signIn: () => Promise<void>
  readonly signOut: () => Promise<void>
  /** Throws `NoAccountError` or `RedirectingError`; callers do not branch. */
  readonly getAccessToken: TokenGetter
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toAccount(account: AccountInfo | null): AccountLike | null {
  if (account === null) {
    return null
  }

  return {
    localAccountId: account.localAccountId,
    idTokenClaims: (account.idTokenClaims ?? undefined) as
      | Record<string, unknown>
      | undefined,
    name: account.name,
    username: account.username,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [msal, setMsal] = useState<PublicClientApplication | null>(null)
  const [config] = useState<AuthConfig | null>(() => {
    try {
      return authConfigFromEnv()
    } catch (error) {
      if (error instanceof AuthConfigError) {
        return null
      }

      throw error
    }
  })
  const [configError] = useState<AuthConfigError | null>(() => {
    try {
      authConfigFromEnv()
      return null
    } catch (error) {
      return error instanceof AuthConfigError ? error : null
    }
  })
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [account, setAccount] = useState<AccountLike | null>(null)

  useEffect(() => {
    if (config === null) {
      setStatus("error")
      return
    }

    const client = createMsal(config)
    let active = true
    setMsal(client)

    void client
      .initialize()
      .then(() => client.handleRedirectPromise())
      .then(async (result) => {
        const signedIn =
          result?.account ?? client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null

        if (signedIn !== null) {
          client.setActiveAccount(signedIn)
        }

        if (!active) {
          return
        }

        setAccount(toAccount(signedIn))
        setStatus(signedIn === null ? "signed-out" : "signed-in")
      })
      .catch((error: unknown) => {
        console.error("[auth] Could not restore the session", error)

        if (active) {
          setStatus("error")
        }
      })

    return () => {
      active = false
    }
  }, [config])

  const signIn = useCallback(async () => {
    if (msal === null || config === null) {
      throw new Error("Sign-in is not configured")
    }

    // MSAL returns to the route that started the sign-in by default.
    await msal.loginRedirect({ scopes: [...config.scopes] })
  }, [config, msal])

  const signOut = useCallback(async () => {
    configureProgressProvider(null)
    clearContent()
    new Outbox(window.localStorage).clear()

    if (msal === null || config === null) {
      setAccount(null)
      setStatus("signed-out")
      return
    }

    const activeAccount = msal.getActiveAccount() ?? undefined

    setAccount(null)
    setStatus("signed-out")

    // A full sign-out also clears the Entra session in this browser.
    await msal.logoutRedirect({
      account: activeAccount,
      postLogoutRedirectUri: config.postLogoutRedirectUri,
    })
  }, [config, msal])

  const getAccessToken = useMemo<TokenGetter>(() => {
    if (msal === null || config === null) {
      return async () => {
        throw new NoAccountError()
      }
    }

    return createTokenGetter(
      {
        getActiveAccount: () => toAccount(msal.getActiveAccount()),
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
  }, [config, msal])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      account,
      oid: accountOid(account),
      displayName: accountDisplayName(account),
      config,
      configError,
      signIn,
      signOut,
      getAccessToken,
    }),
    [
      account,
      config,
      configError,
      getAccessToken,
      signIn,
      signOut,
      status,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)

  if (value === null) {
    throw new Error("useAuth must be used inside AuthProvider")
  }

  return value
}
