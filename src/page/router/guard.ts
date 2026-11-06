import type { Route } from "./routes"

/**
 * The boot guard. Sign-in blocks everything; then character creation blocks
 * everything until a profile has a character. A returning child is never sent
 * back to creation, and a profile without a topic is held on the picker.
 */
export interface RouteState {
  readonly signedIn: boolean
  readonly hasProfile: boolean
  readonly hasTopic?: boolean
}

export function resolveRoute(route: Route | null, state: RouteState): Route {
  if (!state.signedIn) {
    return { id: "signin" }
  }

  if (route?.id === "signin") {
    return state.hasProfile ? { id: "home" } : { id: "create" }
  }

  if (!state.hasProfile) {
    return { id: "create" }
  }

  const resolved: Route =
    route?.id === "create" ? { id: "home" } : (route ?? { id: "home" })

  if (
    state.hasTopic === false &&
    resolved.id !== "topics" &&
    resolved.id !== "install"
  ) {
    return { id: "topics" }
  }

  return resolved
}
