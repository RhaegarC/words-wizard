/**
 * The one place the page performs HTTP. Screens and the provider hand it a
 * path and a body; it owns the base url, the bearer token, the error envelope,
 * and the single refresh-and-retry a `401` earns.
 *
 * Every failure is an `ApiError` so callers can tell "retry this" from "this is
 * a bug" without inspecting a `Response`.
 */

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>

export interface ApiClientOptions {
  /** The Worker origin; a trailing slash is ignored. */
  readonly baseUrl: string
  /** Throws when there is no account or a redirect is under way. */
  readonly getToken: (options?: {
    forceRefresh?: boolean
  }) => Promise<string>
  /** Called after a refreshed token is refused too; returns to sign-in. */
  readonly onUnauthorized: () => void | Promise<void>
  readonly fetchFn?: FetchLike
}

export interface ApiRequestOptions {
  readonly method?: "GET" | "POST" | "PATCH"
  readonly body?: unknown
  readonly signal?: AbortSignal
}

export interface ApiClient {
  request<T>(path: string, options?: ApiRequestOptions): Promise<T>
}

export class ApiError extends Error {
  constructor(
    /** A Worker error code, or `network` when no response arrived. */
    readonly code: string,
    readonly status: number,
    message?: string,
  ) {
    super(message ?? code)
    this.name = "ApiError"
  }

  /**
   * A retryable failure is one the same request could survive: the network
   * never answered, or the server failed while handling it. A 4xx is a
   * decision, not an outage.
   */
  get retryable(): boolean {
    return this.code === "network" || this.status >= 500
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "")
  const fetchFn = options.fetchFn ?? fetch

  const send = async (
    path: string,
    request: ApiRequestOptions,
    token: string,
  ): Promise<Response> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    }

    if (request.body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    try {
      return await fetchFn(`${baseUrl}${path}`, {
        method: request.method ?? "GET",
        headers,
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: request.signal,
      })
    } catch (error) {
      // A caller's own abort is not a network failure.
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error
      }

      throw new ApiError("network", 0, "The API could not be reached.")
    }
  }

  return {
    async request<T>(
      path: string,
      requestOptions: ApiRequestOptions = {},
    ): Promise<T> {
      let response = await send(path, requestOptions, await options.getToken())

      if (response.status === 401) {
        // One silent refresh, one retry. A second refusal is the end of the
        // browser session, not a token that needs another minute.
        response = await send(
          path,
          requestOptions,
          await options.getToken({ forceRefresh: true }),
        )

        if (response.status === 401) {
          await options.onUnauthorized()
          throw new ApiError("unauthorized", 401, "Authentication required.")
        }
      }

      if (!response.ok) {
        throw await toApiError(response)
      }

      if (response.status === 204) {
        return undefined as T
      }

      const text = await response.text()

      return (text === "" ? undefined : JSON.parse(text)) as T
    },
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; message?: unknown }
    }

    if (
      typeof body.error?.code === "string" &&
      typeof body.error.message === "string"
    ) {
      return new ApiError(body.error.code, response.status, body.error.message)
    }
  } catch {
    // A proxy or a crash can answer non-JSON; the status is still the truth.
  }

  return new ApiError("internal", response.status, response.statusText)
}
