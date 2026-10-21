import { describe, expect, it } from "vitest"

import { resolveRoute } from "./guard"
import { ROUTE_SAMPLES } from "./routes"

describe("resolveRoute", () => {
  it("sends a device without a profile to character creation", () => {
    for (const route of ROUTE_SAMPLES) {
      expect(resolveRoute(route, false)).toEqual({ id: "create" })
    }

    expect(resolveRoute(null, false)).toEqual({ id: "create" })
  })

  it("honours the requested route when a profile exists", () => {
    for (const route of ROUTE_SAMPLES) {
      if (route.id === "create") {
        continue
      }

      expect(resolveRoute(route, true)).toEqual(route)
    }
  })

  it("never returns a returning child to character creation", () => {
    expect(resolveRoute({ id: "create" }, true)).toEqual({ id: "home" })
  })

  it("sends an unknown hash to Home when a profile exists", () => {
    expect(resolveRoute(null, true)).toEqual({ id: "home" })
  })

  it("sends a profile without a topic to the picker", () => {
    expect(resolveRoute({ id: "home" }, true, false)).toEqual({ id: "topics" })
    expect(resolveRoute(null, true, false)).toEqual({ id: "topics" })
    expect(resolveRoute({ id: "session" }, true, false)).toEqual({
      id: "topics",
    })
  })

  it("keeps the picker and install step reachable while no topic is set", () => {
    expect(resolveRoute({ id: "topics" }, true, false)).toEqual({ id: "topics" })
    expect(resolveRoute({ id: "install" }, true, false)).toEqual({
      id: "install",
    })
  })
})
