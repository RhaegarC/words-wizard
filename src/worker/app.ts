import { Hono } from "hono"
import type { MiddlewareHandler } from "hono"

import { readConfig } from "./config"
import type { AppEnv } from "./context"
import { corsMiddleware } from "./cors"
import { installErrorHandlers } from "./errors"

/**
 * Paths the Worker answers, with the methods each accepts. The error handler
 * uses this to distinguish 404 from 405; features 22 and 23 extend it.
 */
export const ROUTES: Readonly<Record<string, readonly string[]>> = {
  "/health": ["GET"],
}

const configMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("config", readConfig(c.env))
  await next()
}

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>()

  // Configuration runs first: a missing var fails every path, including
  // /health, rather than leaving a partially configured API serving.
  app.use("*", configMiddleware)
  app.use("*", corsMiddleware())

  app.get("/health", (c) => {
    c.header("Cache-Control", "no-store")
    return c.json({ ok: true })
  })

  installErrorHandlers(app, ROUTES)
  return app
}
