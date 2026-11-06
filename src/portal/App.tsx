import type { PublicClientApplication } from "@azure/msal-browser"
import { useCallback, useEffect, useMemo, useState } from "react"

import type { AdminSnapshot } from "../shared/admin"
import type { Role } from "../shared/types"
import { accountDisplayName, toAccountLike } from "../page/auth/account"
import { NoAccountError, RedirectingError } from "../page/auth/token"

import { portalView } from "./access"
import { AdminRequestError, createAdminApi } from "./api"
import type { AdminApi } from "./api"
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
  routeHref,
  sectionOf,
  type PortalRoute,
  type PortalSection,
} from "./router"
import { roleFromAccessToken } from "./role"

/**
 * The portal application: one Entra session, one staff gate, one content
 * snapshot. The token's role chooses which screen to draw; the Worker decides
 * whether the request is allowed at all. Every accepted write refetches the
 * snapshot, and a stale editor is refreshed rather than silently overwritten.
 */
export default function App() {
  const [initial] = useState(() => readPortalConfig())
  const [msal, setMsal] = useState<PublicClientApplication | null>(null)
  const [account, setAccount] = useState<AccountLike | null>(null)
  const [restored, setRestored] = useState(false)
  const [role, setRole] = useState<Role | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [route, setRoute] = useState<PortalRoute>(() =>
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
      setToken(null)
      setSnapshot(null)
      return
    }

    const config = initial.config
    const client = msal
    let active = true

    async function load(): Promise<void> {
      setError(null)

      try {
        const nextToken = await tokenGetterFor(client, config)()
        if (!active) return

        setToken(nextToken)

        // A token that clearly carries the `user` role needs no round trip;
        // the Worker still refuses it if the claim is wrong.
        const tokenRole = roleFromAccessToken(nextToken)
        setRole(tokenRole)
        if (tokenRole === "user") return

        const api = createAdminApi(config.apiBaseUrl, nextToken)
        const access = await api.access()
        if (!active) return

        setRole(access.role)
        if (access.role === "user") return

        const next = await api.snapshot()
        if (!active) return

        setSnapshot(next)
      } catch (caught: unknown) {
        if (!active) return

        if (caught instanceof NoAccountError) {
          setAccount(null)
          setRole(null)
          setToken(null)
          return
        }

        if (caught instanceof RedirectingError) return

        if (caught instanceof AdminRequestError) {
          if (caught.status === 401) {
            setExpired(true)
            setAccount(null)
            setRole(null)
            setToken(null)
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
    const onHashChange = () => setRoute(parsePortalHash(window.location.hash))

    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  const api = useMemo<AdminApi | null>(() => {
    if (initial.config === null || token === null) return null

    return createAdminApi(initial.config.apiBaseUrl, token)
  }, [initial.config, token])

  const refresh = useCallback(async (): Promise<void> => {
    if (api === null) return

    setSnapshot(await api.snapshot())
  }, [api])

  const report = useCallback(
    (caught: unknown): void => {
      if (caught instanceof AdminRequestError) {
        if (caught.status === 401) {
          setExpired(true)
          setAccount(null)
          setRole(null)
          setToken(null)
          setSnapshot(null)
          return
        }

        if (caught.status === 403) {
          setRole("user")
          return
        }

        setPageError(caught.message)

        // The editor is stale: load the latest snapshot under the banner.
        if (caught.code === "conflict") void refresh()
        return
      }

      console.error("[portal] A write failed", caught)
      setPageError("The change could not be saved.")
    },
    [refresh],
  )

  const navigate = useCallback((next: PortalRoute) => {
    setPageError(null)
    setRoute(next)
    window.location.hash = routeHref(next)
  }, [])

  const notify = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => {
      setNotice((current) => (current === message ? null : current))
    }, 5000)
  }, [])

  const signIn = useCallback(() => {
    if (msal === null || initial.config === null) return

    void msal.loginRedirect({ scopes: [...initial.config.scopes] })
  }, [initial.config, msal])

  const signOut = useCallback(() => {
    setAccount(null)
    setRole(null)
    setToken(null)
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
      section={sectionOf(route)}
      onNavigate={(section) => navigate(sectionRoute(section))}
      onSignOut={signOut}
    >
      {notice === null ? null : <Notice message={notice} />}
      {error === null ? null : (
        <Banner tone="error" message={error} onDismiss={() => setError(null)} />
      )}
      {pageError === null ? null : (
        <Banner
          tone="error"
          message={pageError}
          onDismiss={() => setPageError(null)}
        />
      )}
      {snapshot === null || api === null ? (
        <div className="rounded-[15px] border border-[var(--admin-line)] bg-white p-10 text-center">
          <p className="text-sm font-bold">Loading the content snapshot…</p>
        </div>
      ) : (
        <ScreenContent
          route={route}
          snapshot={snapshot}
          api={api}
          navigate={navigate}
          refresh={refresh}
          notify={notify}
          report={report}
        />
      )}
    </Shell>
  )
}

function sectionRoute(section: PortalSection): PortalRoute {
  if (section === "archived") return { screen: "archived", tab: "topics" }
  if (section === "words") return { screen: "words" }
  return { screen: "topics" }
}

function Notice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mb-5 rounded-[15px] border border-[var(--admin-green)]/25 bg-white px-5 py-3 text-sm font-semibold text-[var(--admin-green)]"
    >
      {message}
    </div>
  )
}

function Banner({
  tone,
  message,
  onDismiss,
}: {
  tone: "error"
  message: string
  onDismiss: () => void
}) {
  return (
    <div
      role="alert"
      className={`mb-5 flex items-start justify-between gap-4 rounded-[15px] border px-5 py-3 text-sm font-semibold ${
        tone === "error"
          ? "border-[var(--admin-coral)]/20 bg-[var(--admin-coral-pale)] text-[var(--admin-coral)]"
          : ""
      }`}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-xs font-black uppercase"
      >
        Dismiss
      </button>
    </div>
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
