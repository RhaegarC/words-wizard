import { useEffect, useState } from "react"

import { progressProvider } from "./db"
import {
  type BootResult,
  checkProfileAtBoot,
  ensureStoragePersistence,
} from "./db/lifecycle"
import { RouteTable } from "./dev/RouteTable"
import type { Profile } from "./domain/types"
import { useLocale } from "./i18n/LocaleProvider"
import { Brand } from "./components/Brand"
import { UpdateProvider } from "./pwa/UpdateProvider"
import { resolveRoute } from "./router/guard"
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
import { TopicPickerScreen } from "./screens/TopicPickerScreen"
import { WordDetailScreen } from "./screens/WordDetailScreen"
import { WordsScreen } from "./screens/WordsScreen"
import { SessionProvider } from "./session/SessionProvider"
import { AppShell } from "./shell/AppShell"

const DEV_ROUTE_TABLE_HASH = "#/__routes"

/**
 * One boot read per page load, shared by StrictMode's double mount. A stale
 * count of `profileAbsentAtBoot` would be a false data-loss signal, so the
 * second effect attaches to the same promise instead of reading again.
 */
let bootCheck: Promise<BootResult> | undefined

function readBootOnce(): Promise<BootResult> {
  bootCheck ??= checkProfileAtBoot(progressProvider)
  return bootCheck
}

export default function App() {
  const { locale, setLocale, t } = useLocale()
  const {
    hash,
    route: requested,
    navigate,
    replace,
    leaveGuard,
  } = useHashRoute()
  const [boot, setBoot] = useState<BootResult | null>(null)
  const [bootFailed, setBootFailed] = useState(false)

  useEffect(() => {
    let active = true

    readBootOnce()
      .then((result) => {
        if (active) {
          setBoot(result)
        }
      })
      .catch((error: unknown) => {
        console.error("[db] Boot check failed", error)

        if (active) {
          setBootFailed(true)
        }
      })

    // A supporting defence only; the UI must not wait for it.
    void ensureStoragePersistence(progressProvider).catch((error: unknown) => {
      console.warn("[db] Storage persistence request failed", error)
    })

    return () => {
      active = false
    }
  }, [])

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

  // The guard decides the screen; the fragment must agree with it. An absent
  // profile lands on `#/create`, and a profile without a topic on `#/topics`.
  // The dev route table stays reachable so routes can be inspected directly.
  useEffect(() => {
    if (boot === null) {
      return
    }

    if (import.meta.env.DEV && hash === DEV_ROUTE_TABLE_HASH) {
      return
    }

    if (boot.status === "absent" && hash !== "#/create") {
      replace({ id: "create" })
      return
    }

    // Creation has just succeeded: first run continues to the install prompt,
    // a returning profile goes straight Home.
    if (boot.status === "present" && hash === "#/create") {
      replace({
        id: boot.profile.currentTopicId === null ? "install" : "home",
      })
      return
    }

    if (
      boot.status === "present" &&
      boot.profile.currentTopicId === null &&
      hash !== "#/topics" &&
      hash !== "#/install"
    ) {
      replace({ id: "topics" })
    }
  }, [boot, hash, replace])

  if (boot === null) {
    return (
      <main className="boot-screen">
        <Brand />
        <p role={bootFailed ? "alert" : "status"}>
          {bootFailed ? t("errors.storageUnavailable") : t("common.loading")}
        </p>
      </main>
    )
  }

  const profile = boot.status === "present" ? boot.profile : null
  const hasProfile = profile !== null
  const hasTopic = profile !== null && profile.currentTopicId !== null
  const route = resolveRoute(requested, hasProfile, hasTopic)
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
    route.id === "create" ? (
      <CreateScreen
        onCreated={(created) =>
          setBoot({ status: "present", profile: created })
        }
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
    route.id === "create" || route.id === "install" || route.id === "topics"

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
      </RouterProvider>
    </UpdateProvider>
  )
}
