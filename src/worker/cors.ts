import type { Context, MiddlewareHandler } from "hono"

import type { WorkerConfig } from "./config"
import type { AppEnv } from "./context"

export const ALLOWED_METHODS = "GET,POST,PATCH,OPTIONS"
export const ALLOWED_HEADERS = "Authorization, Content-Type, If-None-Match"
const MAX_AGE_SECONDS = "86400"

/**
 * Exact-origin CORS: the browser is told which origin it is talking to, never
 * a wildcard, and no credentials are allowed because the API is Bearer-only.
 */
export function applyCorsHeaders(
  c: Context<AppEnv>,
  config: WorkerConfig,
): void {
  const origin = c.req.header("Origin")
  if (!origin || !config.allowedOrigins.includes(origin)) return

  c.header("Access-Control-Allow-Origin", origin)
  c.header("Access-Control-Allow-Methods", ALLOWED_METHODS)
  c.header("Access-Control-Allow-Headers", ALLOWED_HEADERS)
  c.header("Access-Control-Max-Age", MAX_AGE_SECONDS)
}

/**
 * Runs after the config middleware. Preflights short-circuit to 204; an
 * unlisted origin still gets the 204 but without CORS headers, so the browser
 * drops the real request.
 */
export function corsMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.header("Vary", "Origin")
    applyCorsHeaders(c, c.get("config"))

    if (c.req.method === "OPTIONS") return c.body(null, 204)

    await next()
  }
}
