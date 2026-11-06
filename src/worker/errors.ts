import type { Context, ErrorHandler, Hono, NotFoundHandler } from "hono"

import type { ContentIssue } from "../shared/content/types"

import type { AppEnv } from "./context"

/** Stable error identifiers clients may branch on; never free-form text. */
export type ErrorCode =
  | "unauthorized"
  | "forbidden"
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
  | "conflict"
  | "archived"

type ErrorStatus = 400 | 401 | 403 | 404 | 405 | 409 | 422 | 500

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: ErrorStatus,
    message: string,
    readonly headers?: Readonly<Record<string, string>>,
    /** Extra members merged into the `error` envelope (the issue list). */
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message)
    this.name = new.target.name
  }
}

/**
 * A required Worker var is absent, blank, or unusable; the request must not be
 * served. `problem` says which, without changing the stable error code.
 */
export class ConfigError extends AppError {
  constructor(readonly key: string, problem = "Missing or blank") {
    super("config_missing", 500, `${problem} configuration: ${key}`)
  }
}

/** Authentication failed before any handler ran. */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.") {
    super("unauthorized", 401, message, { "WWW-Authenticate": "Bearer" })
  }
}

/** The caller is authenticated but the token's role is not allowed here. */
export class ForbiddenError extends AppError {
  constructor(message = "This operation requires teacher or admin access.") {
    super("forbidden", 403, message)
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

/** The snapshot the client edited is older than the stored content. */
export class ConflictError extends AppError {
  constructor(
    message = "The content changed since it was loaded. Refresh and try again.",
  ) {
    super("conflict", 409, message)
  }
}

/** The row is archived; the portal restores it before an edit. */
export class ArchivedError extends AppError {
  constructor(message = "This row is archived. Restore it before editing.") {
    super("archived", 409, message)
  }
}

/** A content row named by an admin route does not exist. */
export class ContentNotFoundError extends AppError {
  constructor(message = "The requested content row does not exist.") {
    super("not_found", 404, message)
  }
}

/** Structural validation findings, listed in the error envelope. */
export class ContentValidationError extends AppError {
  constructor(readonly issues: readonly ContentIssue[]) {
    super(
      "validation_failed",
      422,
      `The change does not satisfy the content rules: ${[
        ...new Set(issues.map((issue) => issue.code)),
      ].join(", ")}.`,
      undefined,
      {
        issues: issues.map(({ code, severity, id, message }) => ({
          code,
          severity,
          id,
          message,
        })),
      },
    )
  }
}

export function errorResponse(
  c: Context<AppEnv>,
  status: ErrorStatus,
  code: ErrorCode,
  message: string,
  headers?: Readonly<Record<string, string>>,
  details?: Readonly<Record<string, unknown>>,
): Response {
  for (const [name, value] of Object.entries(headers ?? {})) {
    c.header(name, value)
  }

  return c.json(
    details === undefined
      ? { error: { code, message } }
      : { error: { code, message, ...details } },
    status,
  )
}

/**
 * The methods a path accepts, or undefined when it is unknown. Exact paths win;
 * a `:param` segment matches exactly one non-empty segment, so a wrong method
 * on `/v1/admin/topics/:id` is a 405 while a longer path is still a 404.
 */
export function routeMethodsFor(
  routes: Readonly<Record<string, readonly string[]>>,
  path: string,
): readonly string[] | undefined {
  const exact = routes[path]
  if (exact !== undefined) return exact

  for (const [pattern, methods] of Object.entries(routes)) {
    if (pattern.includes(":") && matchesPattern(pattern, path)) return methods
  }

  return undefined
}

function matchesPattern(pattern: string, path: string): boolean {
  const patternParts = pattern.split("/")
  const pathParts = path.split("/")

  if (patternParts.length !== pathParts.length) return false

  return patternParts.every((part, index) => {
    const value = pathParts[index] ?? ""

    return part.startsWith(":") ? value.length > 0 : part === value
  })
}

/**
 * The methods a path accepts, or undefined when it is unknown. Exact paths win;
 * a `:param` segment matches exactly one non-empty segment, so a wrong method
 * on `/v1/admin/topics/:id` is a 405 while a longer path is still a 404.
 */
export function routeMethodsFor(
  routes: Readonly<Record<string, readonly string[]>>,
  path: string,
): readonly string[] | undefined {
  const exact = routes[path]
  if (exact !== undefined) return exact

  for (const [pattern, methods] of Object.entries(routes)) {
    if (pattern.includes(":") && matchesPattern(pattern, path)) return methods
  }

  return undefined
}

function matchesPattern(pattern: string, path: string): boolean {
  const patternParts = pattern.split("/")
  const pathParts = path.split("/")

  if (patternParts.length !== pathParts.length) return false

  return patternParts.every((part, index) => {
    const value = pathParts[index] ?? ""

    return part.startsWith(":") ? value.length > 0 : part === value
  })
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
        error.details,
      )
    }

    // Unexpected exceptions keep their details in the log and nowhere else.
    console.error("[worker] unhandled error", error)
    return errorResponse(c, 500, "internal", "Internal server error.")
  }

  const notFound: NotFoundHandler<AppEnv> = (c) => {
    const methods = routeMethodsFor(routes, c.req.path)
    if (methods) {
      c.header("Allow", methods.join(", "))
      return errorResponse(c, 405, "method_not_allowed", "Method not allowed.")
    }

    return errorResponse(c, 404, "not_found", "Not found.")
  }

  app.onError(onError)
  app.notFound(notFound)
}
