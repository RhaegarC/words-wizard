import type { Role } from "../shared/types"
import type { WorkerConfig, WorkerEnv } from "./config"

/**
 * The authenticated caller. `oid` is the Entra object id — the only value the
 * Worker trusts as an identity, and it always comes from a verified token.
 * `email` and `role` are copied from the same token; neither is ever read from
 * a request body.
 */
export interface Principal {
  readonly oid: string
  readonly email: string | null
  readonly role: Role
}

/**
 * Shared Hono environment: the vars wrangler binds, plus the values the
 * request middleware resolves. A handler reading `principal` is guaranteed
 * it passed `requireAuth`.
 */
export interface AppEnv {
  Bindings: WorkerEnv
  Variables: {
    config: WorkerConfig
    principal: Principal
  }
}
