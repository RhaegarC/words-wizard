import type { Role } from "../shared/types"

/**
 * The four states the portal can be in. Sign-in and Access Denied are screens
 * of their own; the shell only renders in `staff`.
 */
export type PortalView = "loading" | "signed-out" | "denied" | "staff"

export interface PortalAccessInput {
  readonly hasAccount: boolean
  /** Null while the access token is still being acquired. */
  readonly role: Role | null
}

export function portalView(input: PortalAccessInput): PortalView {
  if (!input.hasAccount) return "signed-out"
  if (input.role === null) return "loading"

  return input.role === "user" ? "denied" : "staff"
}
