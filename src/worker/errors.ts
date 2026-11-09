import type { Context, ErrorHandler, Hono, NotFoundHandler } from "hono"

import type { AppEnv } from "./context"

/** Stable error identifiers clients may branch on; never free-form text. */
export type ErrorCode =
  | "unauthorized"
  | "config_missing"
  | "not_found"
  | "method_not_allowed"
  | "internal"
  | "invalid_json"
  | "validation_failed"
  | "clock_out_of_range"
  | "unknown_word"
  | "unknown_pack_word"
  | "profile_not_found"
  | "care_unavailable"

type ErrorStatus = 400 | 401 | 404 | 405 | 409 | 422 | 500

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

/** The body is not JSON at all; nothing is validated or written. */
export class InvalidJsonError extends AppError {
  constructor() {
    super("invalid_json", 400, "The request body is not valid JSON.")
  }
}

/** Any field or range rule; the message names the rule, never the value. */
export class ValidationFailedError extends AppError {
  constructor(message = "The request body is not valid.") {
    super("validation_failed", 422, message)
  }
}

/** A client clock outside the server's ±24-hour window. */
export class ClockOutOfRangeError extends AppError {
  constructor() {
    super("clock_out_of_range", 422, "The supplied time is outside the accepted window.")
  }
}

/** A progress row names a word that is not in D1. */
export class UnknownWordError extends AppError {
  constructor() {
    super("unknown_word", 422, "A progress row names a word that does not exist.")
  }
}

/** An introduction names a `(packId, wordId)` pair absent from `pack_words`. */
export class UnknownPackWordError extends AppError {
  constructor() {
    super("unknown_pack_word", 422, "An introduction names a word that is not in that pack.")
  }
}

/** A route that needs a profile answered before the identity has created one. */
export class ProfileNotFoundError extends AppError {
  constructor() {
    super("profile_not_found", 404, "No profile exists for this identity.")
  }
}

/** No token to spend, or the action is not legal in the character's state. */
export class CareUnavailableError extends AppError {
  constructor(reason: string) {
    super("care_unavailable", 409, `Care is unavailable: ${reason}.`)
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
