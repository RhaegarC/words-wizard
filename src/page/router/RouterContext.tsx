import { createContext, useContext, type ReactNode } from "react"

import type { LeaveGuard } from "./leaveGuard"
import type { Route } from "./routes"

export type RouterValue = {
  navigate: (route: Route) => void
  replace: (route: Route) => void
  leaveGuard: LeaveGuard
}

const RouterContext = createContext<RouterValue | null>(null)

export function RouterProvider({
  value,
  children,
}: {
  value: RouterValue
  children: ReactNode
}) {
  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  )
}

/**
 * The session engine registers its exit confirmation through
 * `leaveGuard.setBeforeLeave`; screens navigate through `navigate`.
 */
export function useRouter(): RouterValue {
  const value = useContext(RouterContext)

  if (!value) {
    throw new Error("useRouter must be used inside RouterProvider")
  }

  return value
}
