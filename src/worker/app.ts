import { Hono } from "hono"
import type { MiddlewareHandler } from "hono"

import { createTokenVerifier } from "./auth"
import type { TokenVerifier } from "./auth"
import type { WorkerConfig } from "./config"
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
import { registerMeRoutes } from "./me"

/**
 * Paths the Worker answers, with the methods each accepts. The error handler
 * uses this to distinguish 404 from 405.
 */
export const ROUTES: Readonly<Record<string, readonly string[]>> = {
  "/health": ["GET"],
  "/v1/content": ["GET"],
  "/v1/me": ["GET"],
  "/v1/me/profile": ["POST", "PATCH"],
  "/v1/me/sessions": ["POST"],
  "/v1/me/metrics": ["POST"],
  "/v1/me/care": ["POST"],
}

/**
 * One verifier per configuration. `readConfig` already returns the same object
 * for the same values, so identity is enough and the remote JWKS cache is not
 * rebuilt on every request.
 */
let cachedVerifier: {
  readonly config: WorkerConfig
  readonly verify: TokenVerifier
} | undefined

function configVerifier(config: WorkerConfig): TokenVerifier {
  if (cachedVerifier?.config === config) return cachedVerifier.verify

  const verify = createTokenVerifier(config)
  cachedVerifier = { config, verify }
  return verify
}

export interface AppOptions {
  /** Injected by tests that mint tokens against a local key set. */
  readonly verifierFor?: (config: WorkerConfig) => TokenVerifier
}

const CONTENT_CACHE_CONTROL = "public, max-age=300"

const configMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("config", readConfig(c.env))
  await next()
}

export function createApp(options: AppOptions = {}): Hono<AppEnv> {
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

  // Authenticated user data. Registered after the config and CORS middleware,
  // so a missing var fails before a token is even looked at.
  registerMeRoutes(app, {
    verifierFor: options.verifierFor ?? configVerifier,
  })

  installErrorHandlers(app, ROUTES)
  return app
}
