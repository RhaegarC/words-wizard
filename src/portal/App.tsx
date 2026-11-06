import type { PublicClientApplication } from "@azure/msal-browser"
import { useCallback, useEffect, useState } from "react"

import type { AdminSnapshot } from "../shared/admin"
import type { Role } from "../shared/types"
import { accountDisplayName, toAccountLike } from "../page/auth/account"
import { NoAccountError, RedirectingError } from "../page/auth/token"

import { portalView } from "./access"
import {
  AdminRequestError,
  fetchAdminAccess,
  fetchAdminSnapshot,
} from "./api"
import {
  loadPortalSession,
  readPortalConfig,
  tokenGetterFor,
  type AccountLike,
} from "./auth"
import { AuthCard } from "./components/AuthCard"
import { Brand } from "./components/Brand"
import { ScreenContent } from "./components/Screens"
import { Shell } from "./components/Shell"
import {
  parsePortalHash,
  screenHref,
  type PortalScreen,
} from "./router"
import { roleFromAccessToken } from "./role"

/**
 * The portal application: one Entra session, one staff gate, one content
 * snapshot. The token's role chooses which screen to draw; the Worker decides
 * whether the request is allowed at all.
 */
export default function App() {
  const [initial] = useState(() => readPortalConfig())
  const [msal, setMsal] = useState<PublicClientApplication | null>(null)
  const [account, setAccount] = useState<AccountLike | null>(null)
  const [restored, setRestored] = useState(false)
  const [role, setRole] = useState<Role | null>(null)
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [screen, setScreen] = useState<PortalScreen>(() =>
    parsePortalHash(window.location.hash),
  )

  useEffect(() => {
    if (initial.config === null) {
      setRestored(true)
      return
    }

    const session = loadPortalSession(initial.config)
    let active = true

    setMsal(session.client as PublicClientApplication)

    void session.ready
      .then((signedIn) => {
        if (!active) return

        setAccount(toAccountLike(signedIn))
        setRestored(true)
      })
      .catch((caught: unknown) => {
        console.error("[portal] Could not restore the session", caught)

        if (!active) return

        setError("The portal could not restore your session.")
        setRestored(true)
      })

    return () => {
      active = false
    }
  }, [initial.config])

  useEffect(() => {
    if (initial.config === null || msal === null || account === null) {
      setRole(null)
      setSnapshot(null)
      return
    }

    const config = initial.config
    const client = msal
    let active = true

    async function load(): Promise<void> {
      setError(null)

      try {
        const token = await tokenGetterFor(client, config)()
        if (!active) return

        // A token that clearly carries the `user` role needs no round trip;
        // the Worker still refuses it if the claim is wrong.
        const tokenRole = roleFromAccessToken(token)
        setRole(tokenRole)
        if (tokenRole === "user") return

        const access = await fetchAdminAccess(config.apiBaseUrl, token)
        if (!active) return

        setRole(access.role)
        if (access.role === "user") return

        const next = await fetchAdminSnapshot(config.apiBaseUrl, token)
        if (!active) return

        setSnapshot(next)
      } catch (caught: unknown) {
        if (!active) return

        if (caught instanceof NoAccountError) {
          setAccount(null)
          setRole(null)
          return
        }

        if (caught instanceof RedirectingError) return

        if (caught instanceof AdminRequestError) {
          if (caught.status === 401) {
            setExpired(true)
            setAccount(null)
            setRole(null)
            return
          }

          if (caught.status === 403) {
            setRole("user")
            return
          }

          setError(caught.message)
          return
        }

        console.error("[portal] Could not load the content snapshot", caught)
        setError("The content snapshot could not be loaded.")
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [account, initial.config, msal])

  useEffect(() => {
    const onHashChange = () => setScreen(parsePortalHash(window.location.hash))

    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  const navigate = useCallback((next: PortalScreen) => {
    setScreen(next)
    window.location.hash = screenHref(next)
  }, [])

  const signIn = useCallback(() => {
    if (msal === null || initial.config === null) return

    void msal.loginRedirect({ scopes: [...initial.config.scopes] })
  }, [initial.config, msal])

  const signOut = useCallback(() => {
    setAccount(null)
    setRole(null)
    setSnapshot(null)

    if (msal === null || initial.config === null) return

    const activeAccount = msal.getActiveAccount() ?? undefined

    void msal.logoutRedirect({
      account: activeAccount,
      postLogoutRedirectUri: initial.config.postLogoutRedirectUri,
    })
  }, [initial.config, msal])

  if (initial.config === null) {
    return <ConfigErrorCard keyName={initial.error} />
  }

  const view = restored
    ? portalView({ hasAccount: account !== null, role })
    : "loading"
  const email = account?.username?.trim() || accountDisplayName(account)

  if (view === "loading") return <AuthCard state="loading" />
  if (view === "signed-out") {
    return <AuthCard state="signed-out" expired={expired} onSignIn={signIn} />
  }
  if (view === "denied") {
    return <AuthCard state="denied" email={email} onSignOut={signOut} />
  }
  if (role === null) return <AuthCard state="loading" />

  return (
    <Shell
      email={email}
      role={role}
      screen={screen}
      onNavigate={navigate}
      onSignOut={signOut}
    >
      <ScreenContent screen={screen} snapshot={snapshot} error={error} />
    </Shell>
  )
}

function ConfigErrorCard({ keyName }: { keyName: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--admin-purple-pale)] p-5 text-[var(--admin-ink)]">
      <section className="w-full max-w-[430px] rounded-2xl border border-white/80 bg-white p-9 text-center shadow-[0_22px_65px_rgba(48,39,71,0.12)]">
        <div className="mb-7 flex justify-center">
          <Brand />
        </div>
        <h1 className="text-2xl font-extrabold tracking-[-0.03em]">
          The portal is not configured.
        </h1>
        <p className="mt-3 text-sm text-[var(--admin-muted)]">
          A required build-time value is missing:{" "}
          <code className="rounded bg-[var(--admin-canvas)] px-1.5 py-0.5 text-xs font-bold">
            {keyName}
          </code>
        </p>
      </section>
    </main>
  )
}
