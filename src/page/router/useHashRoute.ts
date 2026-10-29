import { useCallback, useEffect, useRef, useState } from "react"

import { createLeaveGuard, type LeaveGuard } from "./leaveGuard"
import { buildHash, parseHash, type Route } from "./routes"

export type HashRoute = {
  /** The raw fragment, which also exposes dev-only destinations. */
  hash: string
  /** The requested route, or `null` when the hash names nothing supported. */
  route: Route | null
  navigate: (route: Route) => void
  replace: (route: Route) => void
  leaveGuard: LeaveGuard
}

/**
 * Subscribes to `hashchange` and owns every write to the fragment.
 *
 * Programmatic navigation asks the leave guard once; browser back/forward is
 * checked on the `hashchange` it produces, and a veto restores the accepted
 * fragment. A fragment we wrote ourselves is recorded in `expected` so it is
 * never mistaken for a back/forward and vetoed twice.
 */
export function useHashRoute(): HashRoute {
  const [hash, setHash] = useState(() => window.location.hash)

  const leaveGuardRef = useRef<LeaveGuard | null>(null)
  if (leaveGuardRef.current === null) {
    leaveGuardRef.current = createLeaveGuard()
  }
  const leaveGuard = leaveGuardRef.current

  const accepted = useRef(window.location.hash)
  const expected = useRef<string | null>(null)

  useEffect(() => {
    const onHashChange = () => {
      const next = window.location.hash

      if (expected.current !== null && next === expected.current) {
        expected.current = null
        accepted.current = next
        setHash(next)
        return
      }

      expected.current = null

      if (!leaveGuard.canLeave(next)) {
        const restore = accepted.current || "#"

        if (restore !== next) {
          expected.current = restore
          window.location.replace(restore)
        }

        return
      }

      accepted.current = next
      setHash(next)
    }

    window.addEventListener("hashchange", onHashChange)

    return () => window.removeEventListener("hashchange", onHashChange)
  }, [leaveGuard])

  const commit = useCallback(
    (route: Route, mode: "push" | "replace") => {
      const target = buildHash(route)

      if (!leaveGuard.canLeave(target)) {
        return
      }

      accepted.current = target

      if (target === window.location.hash) {
        setHash(target)
        return
      }

      expected.current = target

      if (mode === "push") {
        window.location.hash = target
      } else {
        window.location.replace(target)
      }
    },
    [leaveGuard],
  )

  const navigate = useCallback(
    (route: Route) => commit(route, "push"),
    [commit],
  )
  const replace = useCallback(
    (route: Route) => commit(route, "replace"),
    [commit],
  )

  return { hash, route: parseHash(hash), navigate, replace, leaveGuard }
}
