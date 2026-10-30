import { useCallback, useEffect, useState } from "react"

import type { Profile } from "@shared/types"
import { createApiClient } from "./api/client"
import { fetchContent } from "./api/content"
import { Outbox } from "./api/outbox"
import { ApiProgressProvider } from "./api/ApiProgressProvider"
import { configureProgressProvider } from "./api/provider"
import { useAuth } from "./auth/AuthProvider"
import type { AuthConfig } from "./auth/config"
import { RedirectingError } from "./auth/token"
import { Brand } from "./components/Brand"
import { loadContent } from "./content"
import {
  type BootResult,
  checkProfileAtBoot,
  ensureStoragePersistence,
} from "./db/lifecycle"
import { discardLegacyLocalData } from "./db/localData"
import { RouteTable } from "./dev/RouteTable"
import { useLocale } from "./i18n/LocaleProvider"
import { UpdateProvider } from "./pwa/UpdateProvider"
import { resolveRoute, type RouteState } from "./router/guard"
import { RouterProvider } from "./router/RouterContext"
import { buildHash, titleKeyFor } from "./router/routes"
import { useHashRoute } from "./router/useHashRoute"
import { CharacterScreen } from "./screens/CharacterScreen"
import { CreateScreen } from "./screens/CreateScreen"
import { HomeScreen } from "./screens/HomeScreen"
import { InstallScreen } from "./screens/InstallScreen"
import { PlaceholderScreen } from "./screens/PlaceholderScreen"
import { ReviewLandingScreen } from "./screens/ReviewLandingScreen"
import { ReviewSummaryScreen } from "./screens/ReviewSummaryScreen"
import { SessionExerciseScreen } from "./screens/SessionExerciseScreen"
import { SessionIntroScreen } from "./screens/SessionIntroScreen"
import { SessionLandingScreen } from "./screens/SessionLandingScreen"
import { SessionSummaryScreen } from "./screens/SessionSummaryScreen"
import { SettingsScreen } from "./screens/SettingsScreen"
import { SignInScreen } from "./screens/SignInScreen"
import { TopicPickerScreen } from "./screens/TopicPickerScreen"
import { WordDetailScreen } from "./screens/WordDetailScreen"
import { WordsScreen } from "./screens/WordsScreen"
import { SessionProvider } from "./session/SessionProvider"
import { AppShell } from "./shell/AppShell"

const DEV_ROUTE_TABLE_HASH = "#/__routes"

interface BootDeps {
  readonly config: AuthConfig
  readonly oid: string
  readonly getAccessToken: (options?: {
    forceRefresh?: boolean
  }) => Promise<string>
  readonly onUnauthorized: () => void | Promise<void>
}

interface BootOutcome {
  readonly result: BootResult
  /** True when the Mission 1 IndexedDB was discarded and the notice is due. */
  readonly notice: boolean
}

/**
 * One boot per page load, shared by StrictMode's double mount. The previous
 * boot's promise is reused while the key (identity and retry count) matches, so
 * the fetch and the profile check happen once.
 */
let bootCache: { key: string; promise: Promise<BootOutcome> } | null = null

function bootOnce(key: string, deps: BootDeps): Promise<BootOutcome> {
  if (bootCache?.key !== key) {
    bootCache = { key, promise: boot(deps) }
  }

  return bootCache.promise
}

/**
 * Boot is online-required: content and the profile are fetched together, and a
 * failure stops the app with a retry screen rather than showing stale content
 * the child cannot act on. A queued commit is replayed after both succeed.
 */
async function boot(deps: BootDeps): Promise<BootOutcome> {
  const client = createApiClient({
    baseUrl: deps.config.apiBaseUrl,
    getToken: deps.getAccessToken,
    onUnauthorized: deps.onUnauthorized,
  })
  const outbox = new Outbox(window.localStorage)
  const provider = new ApiProgressProvider({
    client,
    identity: () => deps.oid,
    outbox,
  })

  const [bundle] = await Promise.all([fetchContent(client), provider.refresh()])

  loadContent(bundle)
  configureProgressProvider(provider)

  // A pending session goes first so the guard decides on the newest state.
  await outbox.drain((payload) => provider.sendCommit(payload).then(() => undefined))

  const notice = await discardLegacyLocalData()
  const result = await checkProfileAtBoot(provider)

  // A supporting defence only; the UI must not wait for it.
  void ensureStoragePersistence(provider).catch((error: unknown) => {
    console.warn("[db] Storage persistence request failed", error)
  })

  return { result, notice }
}

export default function App() {
  const { locale, setLocale, t } = useLocale()
  const auth = useAuth()
  const { hash, route: requested, navigate, replace, leaveGuard } = useHashRoute()
  const [boot, setBoot] = useState<BootResult | null>(null)
  const [bootFailed, setBootFailed] = useState(false)
  const [notice, setNotice] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const { status, config, oid, getAccessToken, signIn } = auth

  useEffect(() => {
    if (status !== "signed-in" || config === null || oid === null) {
      return
    }

    let active = true

    bootOnce(`${oid}:${reloadKey}`, {
      config,
      oid,
      getAccessToken,
      onUnauthorized: signIn,
    })
      .then((outcome) => {
        if (!active) {
          return
        }

        setBoot(outcome.result)
        setNotice(outcome.notice)
      })
      .catch((error: unknown) => {
        // A redirect to sign-in is already under way; the page is leaving.
        if (error instanceof RedirectingError) {
          return
        }

        console.error("[boot] Could not load the online state", error)

        if (active) {
          setBootFailed(true)
        }
      })

    return () => {
      active = false
    }
  }, [config, getAccessToken, oid, reloadKey, signIn, status])

  // The stored profile is the authority on language. The localStorage value
  // only gives the pre-profile screen a sensible language, and the Settings
  // toggle updates both.
  useEffect(() => {
    if (
      boot !== null &&
      boot.status === "present" &&
      boot.profile.locale !== locale
    ) {
      setLocale(boot.profile.locale)
    }
  }, [boot, locale, setLocale])

  // Signed out: the fragment must name the sign-in screen while it shows.
  useEffect(() => {
    if (status === "signed-out" && hash !== "#/signin") {
      replace({ id: "signin" })
    }
  }, [hash, replace, status])

  const profile = boot?.status === "present" ? boot.profile : null
  const hasProfile = profile !== null
  const hasTopic = profile !== null && profile.currentTopicId !== null
  const state: RouteState = { signedIn: status === "signed-in", hasProfile, hasTopic }
  const route = resolveRoute(requested, state)

  // The guard decides the screen; the fragment must agree with it.
  useEffect(() => {
    if (status !== "signed-in" || boot === null) {
      return
    }

    if (import.meta.env.DEV && hash === DEV_ROUTE_TABLE_HASH) {
      return
    }

    const resolved = resolveRoute(requested, state)

    if (buildHash(resolved) !== hash) {
      replace(resolved)
    }
  }, [boot, hash, replace, requested, hasProfile, hasTopic, status])

  const retry = useCallback(() => {
    bootCache = null
    setBoot(null)
    setBootFailed(false)
    setReloadKey((key) => key + 1)
  }, [])

  // Signed out renders the gate before any boot attempt: there is no identity
  // to fetch for, and a configuration error must name the missing key.
  if (status === "signed-out" || auth.configError !== null) {
    return auth.configError === null ? (
      <SignInScreen />
    ) : (
      <main className="boot-screen">
        <Brand />
        <p role="alert">{t("errors.config")}</p>
        <code>{auth.configError.key}</code>
      </main>
    )
  }

  if (status === "error") {
    return (
      <main className="boot-screen">
        <Brand />
        <p role="alert">{t("errors.generic")}</p>
        <button
          type="button"
          className="button primary"
          onClick={() => window.location.reload()}
        >
          {t("common.retry")}
        </button>
      </main>
    )
  }

  if (status === "loading" || boot === null) {
    return (
      <main className="boot-screen">
        <Brand />
        <p role={bootFailed ? "alert" : "status"}>
          {bootFailed
            ? navigator.onLine
              ? t("errors.generic")
              : t("errors.offline")
            : t("common.loading")}
        </p>
        {bootFailed ? (
          <button type="button" className="button primary" onClick={retry}>
            {t("common.retry")}
          </button>
        ) : null}
      </main>
    )
  }

  const router = { navigate, replace, leaveGuard }

  if (import.meta.env.DEV && hash === DEV_ROUTE_TABLE_HASH) {
    return (
      <RouterProvider value={router}>
        <RouteTable hasProfile={hasProfile} />
      </RouterProvider>
    )
  }

  const updateProfile = (next: Profile) =>
    setBoot({ status: "present", profile: next })

  const screen =
    route.id === "signin" ? (
      <SignInScreen />
    ) : route.id === "create" ? (
      <CreateScreen
        onCreated={(created) => {
          setBoot({ status: "present", profile: created })
          replace({
            id: created.currentTopicId === null ? "install" : "home",
          })
        }}
      />
    ) : route.id === "install" && profile ? (
      <InstallScreen profile={profile} />
    ) : route.id === "character" && profile ? (
      <CharacterScreen profile={profile} onProfileUpdated={updateProfile} />
    ) : route.id === "home" && profile ? (
      <HomeScreen profile={profile} onProfileUpdated={updateProfile} />
    ) : route.id === "topics" && profile ? (
      <TopicPickerScreen
        profile={profile}
        fromSettings={route.from === "settings"}
        onChosen={(next) => {
          setBoot({ status: "present", profile: next })
          navigate(
            route.from === "settings" ? { id: "settings" } : { id: "home" },
          )
        }}
      />
    ) : route.id === "settings" && profile ? (
      <SettingsScreen profile={profile} onProfileUpdated={updateProfile} />
    ) : route.id === "words" && profile ? (
      <WordsScreen profile={profile} tab={route.tab} />
    ) : route.id === "word-detail" && profile ? (
      <WordDetailScreen profile={profile} wordId={route.wordId} />
    ) : route.id === "session" ? (
      <SessionLandingScreen />
    ) : route.id === "session-intro" ? (
      <SessionIntroScreen />
    ) : route.id === "session-exercise" ? (
      <SessionExerciseScreen />
    ) : route.id === "session-summary" ? (
      <SessionSummaryScreen />
    ) : route.id === "review" ? (
      <ReviewLandingScreen />
    ) : route.id === "review-exercise" ? (
      <SessionExerciseScreen />
    ) : route.id === "review-summary" ? (
      <ReviewSummaryScreen />
    ) : (
      <PlaceholderScreen route={route} />
    )

  // First-run screens are their own full-page layouts; everything else lives
  // inside the sidebar frame.
  const standalone =
    route.id === "create" ||
    route.id === "install" ||
    route.id === "topics" ||
    route.id === "signin"

  const shell =
    profile === null || standalone ? (
      screen
    ) : (
      <AppShell
        profile={profile}
        route={route}
        title={t(titleKeyFor(route))}
        routeKey={buildHash(route)}
      >
        {screen}
      </AppShell>
    )

  const inSession =
    route.id === "session" ||
    route.id === "session-intro" ||
    route.id === "session-exercise" ||
    route.id === "session-summary" ||
    route.id === "review" ||
    route.id === "review-exercise" ||
    route.id === "review-summary"

  // The provider sits outside the shell so its exit dialog covers the whole
  // frame, and stays mounted as the session moves between its own routes.
  return (
    <UpdateProvider>
      <RouterProvider value={router}>
        {inSession && profile ? (
          <SessionProvider
            // A switch between the daily and monthly families starts clean.
            key={
              route.id === "review" ||
              route.id === "review-exercise" ||
              route.id === "review-summary"
                ? "monthly"
                : "daily"
            }
            profile={profile}
            route={route}
            onProfileUpdated={(next) =>
              setBoot({ status: "present", profile: next })
            }
            onProfileLost={() => setBoot({ status: "absent" })}
          >
            {shell}
          </SessionProvider>
        ) : (
          shell
        )}

        {notice ? (
          <div className="modal-backdrop">
            <div
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="local-data-title"
            >
              <h2 id="local-data-title" className="modal-title">
                {t("notice.localDataTitle")}
              </h2>
              <p className="modal-body">{t("notice.localDataBody")}</p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setNotice(false)}
                  autoFocus
                >
                  {t("notice.localDataAck")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </RouterProvider>
    </UpdateProvider>
  )
}
