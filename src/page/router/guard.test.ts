import { describe, expect, it } from "vitest"

import { resolveRoute, type RouteState } from "./guard"
import { ROUTE_SAMPLES } from "./routes"

function state(overrides: Partial<RouteState> = {}): RouteState {
  return { signedIn: true, hasProfile: true, ...overrides }
}

describe("resolveRoute", () => {
  it("sends a signed-out device to sign-in, whatever it asked for", () => {
    for (const route of ROUTE_SAMPLES) {
      expect(resolveRoute(route, state({ signedIn: false }))).toEqual({
        id: "signin",
      })
    }

    expect(resolveRoute(null, state({ signedIn: false }))).toEqual({
      id: "signin",
    })
  })

  it("sends a signed-in device without a profile to character creation", () => {
    for (const route of ROUTE_SAMPLES) {
      if (route.id === "signin") {
        continue
      }

      expect(resolveRoute(route, state({ hasProfile: false }))).toEqual({
        id: "create",
      })
    }

    expect(resolveRoute(null, state({ hasProfile: false }))).toEqual({
      id: "create",
    })
  })

  it("never leaves a signed-in child on the sign-in screen", () => {
    expect(resolveRoute({ id: "signin" }, state())).toEqual({ id: "home" })
    expect(
      resolveRoute({ id: "signin" }, state({ hasProfile: false })),
    ).toEqual({ id: "create" })
  })

  it("honours the requested route when a profile exists", () => {
    for (const route of ROUTE_SAMPLES) {
      if (route.id === "create" || route.id === "signin") {
        continue
      }

      expect(resolveRoute(route, state())).toEqual(route)
    }
  })

  it("never returns a returning child to character creation", () => {
    expect(resolveRoute({ id: "create" }, state())).toEqual({ id: "home" })
  })

  it("sends an unknown hash to Home when a profile exists", () => {
    expect(resolveRoute(null, state())).toEqual({ id: "home" })
  })

  it("sends a profile without a topic to the picker", () => {
    expect(resolveRoute({ id: "home" }, state({ hasTopic: false }))).toEqual({
      id: "topics",
    })
    expect(resolveRoute(null, state({ hasTopic: false }))).toEqual({
      id: "topics",
    })
    expect(
      resolveRoute({ id: "session" }, state({ hasTopic: false })),
    ).toEqual({ id: "topics" })
  })

  it("keeps the picker and install step reachable while no topic is set", () => {
    expect(resolveRoute({ id: "topics" }, state({ hasTopic: false }))).toEqual({
      id: "topics",
    })
    expect(resolveRoute({ id: "install" }, state({ hasTopic: false }))).toEqual({
      id: "install",
    })
  })
})
