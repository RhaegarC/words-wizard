import type { Hono, MiddlewareHandler } from "hono"

import { readAdminSnapshot } from "./adminContent"
import { registerAdminWriteRoutes } from "./adminWrite"
import { requireAuth, requireRole } from "./auth"
import type { TokenVerifier } from "./auth"
import { requireDb } from "./config"
import type { WorkerConfig } from "./config"
import type { AppEnv } from "./context"

/**
 * The admin API boundary (feature 28).
 *
 * Every `/v1/admin` request runs the same three middleware in order: no-store,
 * authentication, then the staff role gate. A signed-in `user` is refused
 * before a handler body reads D1, and the role is never taken from a body.
 * Feature 29 registers its write routes behind this same chain.
 */

/** Teacher and admin are identical in v1; admin-only capabilities come later. */
export const STAFF_ROLES = ["teacher", "admin"] as const

export interface AdminRouterOptions {
  /** Resolves the verifier for the current configuration; cached by the app. */
  readonly verifierFor: (config: WorkerConfig) => TokenVerifier
}

export function registerAdminRoutes(
  app: Hono<AppEnv>,
  options: AdminRouterOptions,
): void {
  const noStore: MiddlewareHandler<AppEnv> = async (c, next) => {
    c.header("Cache-Control", "no-store")
    await next()
  }

  for (const path of ["/v1/admin", "/v1/admin/*"]) {
    app.use(path, noStore)
    app.use(path, async (c, next) => {
      await requireAuth(options.verifierFor(c.get("config")))(c, next)
    })
    app.use(path, requireRole(STAFF_ROLES))
  }

  app.get("/v1/admin/access", (c) => c.json({ role: c.get("principal").role }))

  app.get("/v1/admin/content", async (c) =>
    c.json(await readAdminSnapshot(requireDb(c.env))),
  )

  // Writes run behind the same no-store → auth → role chain registered above.
  registerAdminWriteRoutes(app)
}
