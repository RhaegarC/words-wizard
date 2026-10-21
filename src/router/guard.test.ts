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
      expect(resolveRoute(route, true)).toEqual(route)
    }
  })

  it("sends an unknown hash to Home when a profile exists", () => {
    expect(resolveRoute(null, true)).toEqual({ id: "home" })
  })
})
