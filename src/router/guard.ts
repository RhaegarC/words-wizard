import type { Route } from "./routes"

/**
 * The boot guard. Character creation blocks everything until a profile has a
 * character; after that the requested route is honoured and an unknown hash
 * lands on Home.
 */
export function resolveRoute(route: Route | null, hasProfile: boolean): Route {
  if (!hasProfile) {
    return { id: "create" }
  }

  return route ?? { id: "home" }
}
