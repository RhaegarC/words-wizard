import { useState } from "react"

import { RouteTable } from "./dev/RouteTable"
import { readDevProfile, writeDevProfile } from "./dev/devProfile"
import { resolveRoute } from "./router/guard"
import { RouterProvider } from "./router/RouterContext"
import { buildHash, parentOf, titleFor } from "./router/routes"
import { useHashRoute } from "./router/useHashRoute"
import { PlaceholderScreen } from "./screens/PlaceholderScreen"
import { AppShell } from "./shell/AppShell"

const DEV_ROUTE_TABLE_HASH = "#/__routes"

export default function App() {
  const {
    hash,
    route: requested,
    navigate,
    replace,
    leaveGuard,
  } = useHashRoute()
  const [devProfile, setDevProfile] = useState(readDevProfile)

  // Stand-in until feature 05 reads profile presence from Dexie.
  const hasProfile = devProfile
  const route = resolveRoute(requested, hasProfile)
  const parent = parentOf(route)
  const router = { navigate, replace, leaveGuard }

  const toggleProfile = (present: boolean) => {
    writeDevProfile(present)
    setDevProfile(present)
  }

  if (import.meta.env.DEV && hash === DEV_ROUTE_TABLE_HASH) {
    return (
      <RouterProvider value={router}>
        <RouteTable hasProfile={hasProfile} onToggleProfile={toggleProfile} />
      </RouterProvider>
    )
  }

  return (
    <RouterProvider value={router}>
      <AppShell
        title={titleFor(route)}
        routeKey={buildHash(route)}
        onBack={parent ? () => navigate(parent) : undefined}
      >
        <PlaceholderScreen route={route} />
      </AppShell>
    </RouterProvider>
  )
}
