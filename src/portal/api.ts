import type { AdminAccess, AdminSnapshot } from "../shared/admin"

/**
 * The two admin reads the shell needs. A non-2xx response is an error the
 * shell interprets: 401 means the session expired, 403 means Access Denied.
 */
export class AdminRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "AdminRequestError"
  }
}

async function adminGet<T>(
  apiBaseUrl: string,
  path: string,
  token: string,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new AdminRequestError(0, "The server could not be reached.")
  }

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      response.status === 403
        ? "This account does not have admin access."
        : "The admin request failed.",
    )
  }

  return (await response.json()) as T
}

export function fetchAdminAccess(
  apiBaseUrl: string,
  token: string,
): Promise<AdminAccess> {
  return adminGet<AdminAccess>(apiBaseUrl, "/v1/admin/access", token)
}

export function fetchAdminSnapshot(
  apiBaseUrl: string,
  token: string,
): Promise<AdminSnapshot> {
  return adminGet<AdminSnapshot>(apiBaseUrl, "/v1/admin/content", token)
}
