import { Hono } from "hono"
import type { MiddlewareHandler } from "hono"

import { createTokenVerifier } from "./auth"
import type { TokenVerifier } from "./auth"
import { AVATAR_CACHE_CONTROL, isAvatarKey } from "./avatar"
import type { WorkerConfig } from "./config"
import { readConfig, requireAvatars, requireDb } from "./config"
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
  "/v1/me/import": ["POST"],
  "/v1/me/avatar": ["POST", "DELETE"],
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

  // Public: an `<img>` cannot send a Bearer token. The path after the prefix
  // is the full R2 key, and only keys the upload route could have written are
  // read, so `..` and another prefix are refused before R2 is touched.
  app.get("/v1/avatars/*", async (c) => {
    const key = c.req.path.slice("/v1/avatars/".length)
    if (!isAvatarKey(key)) return c.notFound()
    const object = await requireAvatars(c.env).get(key)
    if (object === null) return c.notFound()
    c.header(
      "Content-Type",
      object.httpMetadata?.contentType ?? "application/octet-stream",
    )
    c.header("Cache-Control", AVATAR_CACHE_CONTROL)
    return c.body(object.body)
  })
  // Authenticated user data. Registered after the config and CORS middleware,
  // so a missing var fails before a token is even looked at.
  registerMeRoutes(app, {
    verifierFor: options.verifierFor ?? configVerifier,
  })

  installErrorHandlers(app, ROUTES)
  return app
}
