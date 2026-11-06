import type { Role } from "../shared/types"

/**
 * Reads the role claim for the portal's own UI only.
 *
 * The Worker is the enforcement point: it verifies the signature and refuses a
 * non-staff caller. This function never authorizes anything; it decides which
 * shell to draw while the first admin request is in flight. A token that
 * cannot be read is treated as the least privileged role.
 */
export function roleFromAccessToken(token: string): Role {
  const payload = decodePayload(token)
  const roles = payload?.roles

  if (!Array.isArray(roles)) return "user"
  if (roles.includes("admin")) return "admin"
  if (roles.includes("teacher")) return "teacher"

  return "user"
}

function decodePayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1]
  if (part === undefined || part === "") return null

  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    const parsed: unknown = JSON.parse(atob(padded))

    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
