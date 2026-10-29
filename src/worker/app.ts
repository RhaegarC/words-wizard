import { Hono } from "hono"
import type { MiddlewareHandler } from "hono"

import { readConfig, requireDb } from "./config"
import {
  contentEtag,
  ifNoneMatchMatches,
  readContent,
  readContentVersion,
} from "./content"
import type { AppEnv } from "./context"
import { corsMiddleware } from "./cors"
import { installErrorHandlers } from "./errors"

/**
 * Paths the Worker answers, with the methods each accepts. The error handler
 * uses this to distinguish 404 from 405; feature 23 extends it.
 */
export const ROUTES: Readonly<Record<string, readonly string[]>> = {
  "/health": ["GET"],
  "/v1/content": ["GET"],
}

const CONTENT_CACHE_CONTROL = "public, max-age=300"

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

  app.get("/health", async (c) => {
    const contentVersion = await readContentVersion(requireDb(c.env))

    c.header("Cache-Control", "no-store")
    return c.json({ ok: true, contentVersion })
  })

  // Public: content is read-only and the same for every caller. The ETag is
  // derived from `contentVersion`, so a corrected word reaches the client
  // without a rebuild while an unchanged version costs one 304.
  app.get("/v1/content", async (c) => {
    const bundle = await readContent(requireDb(c.env))
    const etag = contentEtag(bundle.meta.contentVersion)

    c.header("ETag", etag)
    c.header("Cache-Control", CONTENT_CACHE_CONTROL)

    if (ifNoneMatchMatches(c.req.header("If-None-Match"), etag)) {
      return c.body(null, 304)
    }

    return c.json(bundle)
  })

  installErrorHandlers(app, ROUTES)
  return app
}
