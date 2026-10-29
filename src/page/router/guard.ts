import type { Route } from "./routes"

/**
 * The boot guard. Character creation blocks everything until a profile has a
 * character; a returning child is never sent back to creation, and a profile
 * that has not chosen a topic is held on the picker.
 */
export function resolveRoute(
  route: Route | null,
  hasProfile: boolean,
  hasTopic = true,
): Route {
  if (!hasProfile) {
    return { id: "create" }
  }

  const resolved: Route =
    route?.id === "create" ? { id: "home" } : (route ?? { id: "home" })

  if (!hasTopic && resolved.id !== "topics" && resolved.id !== "install") {
    return { id: "topics" }
  }

  return resolved
}
