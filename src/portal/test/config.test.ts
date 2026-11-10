import { describe, expect, it } from "vitest"

import { readPortalConfig } from "../auth"

/**
 * The portal is single-tenant by design: it restricts sign-in to the home
 * tenant, whose members alone can hold the teacher/admin app roles. The child
 * app keeps the multi-tenant `common` authority; the portal must not inherit
 * it from the shared `src/.env`.
 */

// A GUID, and deliberately not a real tenant or client id.
const HOME_TENANT = "11111111-1111-1111-1111-111111111111"
const PORTAL_TENANT_KEY = "VITE_PORTAL_ENTRA_TENANT_ID"

const ENV = {
  VITE_ENTRA_CLIENT_ID: "client-id",
  VITE_ENTRA_TENANT_ID: "common",
  VITE_PORTAL_ENTRA_TENANT_ID: HOME_TENANT,
  VITE_ENTRA_SCOPE: "api://client-id/access_as_user",
  VITE_API_BASE_URL: "https://api.example.test",
}

describe("readPortalConfig", () => {
  it("signs in against the home tenant, not the shared common authority", () => {
    const result = readPortalConfig(ENV, "https://admin.example.test")

    expect(result.error).toBeNull()
    expect(result.config?.tenantId).toBe(HOME_TENANT)
    expect(result.config?.authority).toBe(
      `https://login.microsoftonline.com/${HOME_TENANT}`,
    )
  })

  it("does not need the child app's tenant variable", () => {
    const result = readPortalConfig(
      { ...ENV, VITE_ENTRA_TENANT_ID: undefined },
      "https://admin.example.test",
    )

    expect(result.config?.authority).toBe(
      `https://login.microsoftonline.com/${HOME_TENANT}`,
    )
  })

  it("trims surrounding whitespace", () => {
    const result = readPortalConfig(
      { ...ENV, VITE_PORTAL_ENTRA_TENANT_ID: `  ${HOME_TENANT}\n` },
      "https://admin.example.test",
    )

    expect(result.config?.tenantId).toBe(HOME_TENANT)
  })

  it("refuses a missing portal tenant and names the key", () => {
    const result = readPortalConfig(
      { ...ENV, VITE_PORTAL_ENTRA_TENANT_ID: undefined },
      "https://admin.example.test",
    )

    expect(result.config).toBeNull()
    expect(result.error).toBe(PORTAL_TENANT_KEY)
  })

  it("refuses a blank portal tenant", () => {
    const result = readPortalConfig(
      { ...ENV, VITE_PORTAL_ENTRA_TENANT_ID: "   " },
      "https://admin.example.test",
    )

    expect(result.error).toBe(PORTAL_TENANT_KEY)
  })

  it.each([
    "common",
    "organizations",
    "consumers",
    "contoso.onmicrosoft.com",
  ])("refuses %s, which is not a tenant id", (tenant) => {
    const result = readPortalConfig(
      { ...ENV, VITE_PORTAL_ENTRA_TENANT_ID: tenant },
      "https://admin.example.test",
    )

    expect(result.config).toBeNull()
    expect(result.error).toBe(PORTAL_TENANT_KEY)
  })

  it("still names a missing shared value", () => {
    const result = readPortalConfig(
      { ...ENV, VITE_ENTRA_CLIENT_ID: undefined },
      "https://admin.example.test",
    )

    expect(result.error).toBe("VITE_ENTRA_CLIENT_ID")
  })
})
