import { useEffect, useState } from "react"

import { SleepOverlay } from "./components/SleepOverlay"
import { progressProvider } from "./db"
import {
  type BootResult,
  checkProfileAtBoot,
  ensureStoragePersistence,
} from "./db/lifecycle"
import { RouteTable } from "./dev/RouteTable"
import type { Profile } from "./domain/types"
import { useLocale } from "./i18n/LocaleProvider"
import { resolveRoute } from "./router/guard"
import { RouterProvider } from "./router/RouterContext"
import { buildHash, parentOf, titleKeyFor } from "./router/routes"
import { useHashRoute } from "./router/useHashRoute"
import { CharacterScreen } from "./screens/CharacterScreen"
import { CreateScreen } from "./screens/CreateScreen"
import { PlaceholderScreen } from "./screens/PlaceholderScreen"
import { SessionExerciseScreen } from "./screens/SessionExerciseScreen"
import { SessionIntroScreen } from "./screens/SessionIntroScreen"
import { SessionLandingScreen } from "./screens/SessionLandingScreen"
import { SessionSummaryScreen } from "./screens/SessionSummaryScreen"
import { TopicPickerScreen } from "./screens/TopicPickerScreen"
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
  const { t } = useLocale()
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

    if (
      boot.status === "present" &&
      boot.profile.currentTopicId === null &&
      hash !== "#/topics" &&
      hash !== "#/install"
    ) {
      replace({ id: "topics" })
      return
    }

    if (boot.status === "present" && hash === "#/create") {
      replace({ id: "home" })
    }
  }, [boot, hash, replace])

  if (boot === null) {
    return (
      <main className="boot-screen">
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
  const parent = hasTopic ? parentOf(route) : null
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
        onCreated={(created) => setBoot({ status: "present", profile: created })}
      />
    ) : route.id === "character" && profile ? (
      <CharacterScreen profile={profile} onProfileUpdated={updateProfile} />
    ) : route.id === "home" && profile ? (
      <>
        <SleepOverlay
          profile={profile}
          onProfileUpdated={updateProfile}
        />
        <PlaceholderScreen route={route} />
      </>
    ) : route.id === "topics" && profile ? (
      <TopicPickerScreen
        profile={profile}
        onChosen={(next) => {
          setBoot({ status: "present", profile: next })
          navigate({ id: "home" })
        }}
      />
    ) : route.id === "session" ? (
      <SessionLandingScreen />
    ) : route.id === "session-intro" ? (
      <SessionIntroScreen />
    ) : route.id === "session-exercise" ? (
      <SessionExerciseScreen />
    ) : route.id === "session-summary" ? (
      <SessionSummaryScreen />
    ) : (
      <PlaceholderScreen route={route} />
    )

  const shell = (
    <AppShell
      title={t(titleKeyFor(route))}
      routeKey={buildHash(route)}
      onBack={parent ? () => navigate(parent) : undefined}
    >
      {screen}
    </AppShell>
  )

  const inSession =
    route.id === "session" ||
    route.id === "session-intro" ||
    route.id === "session-exercise" ||
    route.id === "session-summary"

  // The provider sits outside the shell so its exit dialog covers the whole
  // frame, and stays mounted as the session moves between its own routes.
  return (
    <RouterProvider value={router}>
      {inSession && profile ? (
        <SessionProvider
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
  )
}
