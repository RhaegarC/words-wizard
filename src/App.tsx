import { useEffect, useState } from "react"

import { progressProvider } from "./db"
import {
  type BootResult,
  checkProfileAtBoot,
  ensureStoragePersistence,
} from "./db/lifecycle"
import { RouteTable } from "./dev/RouteTable"
import { useLocale } from "./i18n/LocaleProvider"
import { resolveRoute } from "./router/guard"
import { RouterProvider } from "./router/RouterContext"
import { buildHash, parentOf, titleKeyFor } from "./router/routes"
import { useHashRoute } from "./router/useHashRoute"
import { CreateScreen } from "./screens/CreateScreen"
import { PlaceholderScreen } from "./screens/PlaceholderScreen"
import { TopicPickerScreen } from "./screens/TopicPickerScreen"
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

  return (
    <RouterProvider value={router}>
      <AppShell
        title={t(titleKeyFor(route))}
        routeKey={buildHash(route)}
        onBack={parent ? () => navigate(parent) : undefined}
      >
        {route.id === "create" ? (
          <CreateScreen
            onCreated={(created) => setBoot({ status: "present", profile: created })}
          />
        ) : route.id === "topics" && profile ? (
          <TopicPickerScreen
            profile={profile}
            onChosen={(next) => {
              setBoot({ status: "present", profile: next })
              navigate({ id: "home" })
            }}
          />
        ) : (
          <PlaceholderScreen route={route} />
        )}
      </AppShell>
    </RouterProvider>
  )
}
