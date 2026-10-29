import type { Context, ErrorHandler, Hono, NotFoundHandler } from "hono"

import type { AppEnv } from "./context"

/** Stable error identifiers clients may branch on; never free-form text. */
export type ErrorCode = "unauthorized" | "config_missing" | "not_found" | "method_not_allowed" | "internal"

type ErrorStatus = 400 | 401 | 404 | 405 | 500

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: ErrorStatus,
    message: string,
    readonly headers?: Readonly<Record<string, string>>,
  ) {
    super(message)
    this.name = new.target.name
  }
}

/** A required Worker var is absent or blank; the request must not be served. */
export class ConfigError extends AppError {
  constructor(readonly key: string) {
    super("config_missing", 500, `Missing or blank configuration: ${key}`)
  }
}

/** Authentication failed before any handler ran. */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.") {
    super("unauthorized", 401, message, { "WWW-Authenticate": "Bearer" })
  }
}

export function errorResponse(
  c: Context<AppEnv>,
  status: ErrorStatus,
  code: ErrorCode,
  message: string,
  headers?: Readonly<Record<string, string>>,
): Response {
  for (const [name, value] of Object.entries(headers ?? {})) {
    c.header(name, value)
  }

  return c.json({ error: { code, message } }, status)
}

/**
 * Installs the one error path shared by the Worker and by the small apps the
 * tests build. `routes` lets a 405 name the methods a known path accepts.
 */
export function installErrorHandlers(
  app: Hono<AppEnv>,
  routes: Readonly<Record<string, readonly string[]>> = {},
): void {
  const onError: ErrorHandler<AppEnv> = (error, c) => {
    if (error instanceof AppError) {
      // The key name is diagnostic, not a secret; values never reach the log.
      if (error.code === "config_missing") {
        console.error(`[worker] ${error.message}`)
      }

      return errorResponse(
        c,
        error.status,
        error.code,
        error.message,
        error.headers,
      )
    }

    // Unexpected exceptions keep their details in the log and nowhere else.
    console.error("[worker] unhandled error", error)
    return errorResponse(c, 500, "internal", "Internal server error.")
  }

  const notFound: NotFoundHandler<AppEnv> = (c) => {
    const methods = routes[c.req.path]
    if (methods) {
      c.header("Allow", methods.join(", "))
      return errorResponse(c, 405, "method_not_allowed", "Method not allowed.")
    }

    return errorResponse(c, 404, "not_found", "Not found.")
  }

  app.onError(onError)
  app.notFound(notFound)
}
