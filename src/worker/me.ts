import type { Context, Hono, MiddlewareHandler } from "hono"

import { validateServerSessionPayload } from "../shared/sessionPayload"
import type { ServerSessionCommitPayload } from "../shared/sessionPayload"

import { requireAuth } from "./auth"
import type { TokenVerifier } from "./auth"
import type { WorkerConfig } from "./config"
import { requireDb } from "./config"
import type { AppEnv } from "./context"
import {
  avatarExists,
  commitSession,
  createProfile,
  ensureUser,
  patchProfile,
  readMe,
  readProfile,
  topicExists,
  writeMetric,
  applyCare,
} from "./db/queries"
import {
  ClockOutOfRangeError,
  InvalidJsonError,
  ProfileNotFoundError,
  ValidationFailedError,
} from "./errors"
import {
  MAX_BODY_BYTES,
  parseCareEvent,
  parseCreateProfile,
  parseJsonBody,
  parseMetricEvent,
  parseProfilePatch,
} from "./profileInput"

/**
 * The six authenticated user-data routes (feature 23).
 *
 * Identity is always the verified token's `oid`. No route reads a user id,
 * profile id, or `oid` from the body or the path, and an unknown body field is
 * rejected rather than merged. Responses carry `Cache-Control: no-store`
 * because they are one person's data.
 */

export interface MeRouterOptions {
  /** Resolves the verifier for the current configuration; cached by the app. */
  readonly verifierFor: (config: WorkerConfig) => TokenVerifier
}

export function registerMeRoutes(
  app: Hono<AppEnv>,
  options: MeRouterOptions,
): void {
  const auth: MiddlewareHandler<AppEnv> = async (c, next) => {
    c.header("Cache-Control", "no-store")
    await requireAuth(options.verifierFor(c.get("config")))(c, next)
  }

  app.use("/v1/me", auth)
  app.use("/v1/me/*", auth)

  app.get("/v1/me", async (c) => {
    const db = requireDb(c.env)
    const oid = c.get("principal").oid

    await ensureUser(db, oid, Date.now())
    return c.json(await readMe(db, oid))
  })

  app.post("/v1/me/profile", async (c) => {
    const parsed = parseCreateProfile(await readBody(c), Date.now())
    if (!parsed.ok) throw new ValidationFailedError(describe(parsed.issues))

    const db = requireDb(c.env)
    const oid = c.get("principal").oid
    const input = parsed.value

    // The allowlists are rows, not constants: an id is accepted only if D1 has it.
    if (!(await avatarExists(db, input.avatar))) {
      throw new ValidationFailedError("Unknown avatar.")
    }
    if (input.currentTopicId !== null && !(await topicExists(db, input.currentTopicId))) {
      throw new ValidationFailedError("Unknown topic.")
    }

    await ensureUser(db, oid, input.now)
    const result = await createProfile(db, oid, input, input.now)

    return c.json(result.profile, result.created ? 201 : 200)
  })

  app.patch("/v1/me/profile", async (c) => {
    const parsed = parseProfilePatch(await readBody(c))
    if (!parsed.ok) throw new ValidationFailedError(describe(parsed.issues))

    const db = requireDb(c.env)
    const oid = c.get("principal").oid
    const patch = parsed.value

    await ensureUser(db, oid, Date.now())
    if ((await readProfile(db, oid)) === null) throw new ProfileNotFoundError()

    if (patch.avatar !== undefined && !(await avatarExists(db, patch.avatar))) {
      throw new ValidationFailedError("Unknown avatar.")
    }
    if (
      patch.currentTopicId !== undefined &&
      patch.currentTopicId !== null &&
      !(await topicExists(db, patch.currentTopicId))
    ) {
      throw new ValidationFailedError("Unknown topic.")
    }

    const profile = await patchProfile(db, oid, patch)
    if (profile === null) throw new ProfileNotFoundError()
    return c.json(profile)
  })

  app.post("/v1/me/sessions", async (c) => {
    const payload = await readBody(c)
    const issues = validateServerSessionPayload(payload, Date.now())

    // A clock outside the window has its own code; it is the one issue worth
    // answering differently because the client's device time is the cause.
    if (issues.includes("clock-out-of-range")) throw new ClockOutOfRangeError()
    if (issues.length > 0) throw new ValidationFailedError(describe(issues))

    const db = requireDb(c.env)
    const oid = c.get("principal").oid
    const now = Date.now()

    await ensureUser(db, oid, now)
    return c.json(await commitSession(db, oid, payload as ServerSessionCommitPayload, now))
  })

  app.post("/v1/me/metrics", async (c) => {
    const parsed = parseMetricEvent(await readBody(c))
    if (!parsed.ok) throw new ValidationFailedError(describe(parsed.issues))

    const db = requireDb(c.env)
    const oid = c.get("principal").oid
    const now = Date.now()

    await ensureUser(db, oid, now)
    return c.json(await writeMetric(db, oid, parsed.value, now))
  })

  app.post("/v1/me/care", async (c) => {
    const parsed = parseCareEvent(await readBody(c))
    if (!parsed.ok) throw new ValidationFailedError(describe(parsed.issues))

    const db = requireDb(c.env)
    const oid = c.get("principal").oid
    const now = Date.now()

    await ensureUser(db, oid, now)
    const profile = await applyCare(db, oid, parsed.value.action, parsed.value.eventId, now)
    return c.json({ profile })
  })
}

/**
 * Read the body once, refusing a declared oversize before the text is
 * touched and the actual byte length before `JSON.parse`.
 */
async function readBody(c: Context<AppEnv>): Promise<unknown> {
  const declared = c.req.header("content-length")

  if (declared !== undefined) {
    const size = Number(declared)
    if (Number.isFinite(size) && size > MAX_BODY_BYTES) {
      throw new ValidationFailedError("Request body exceeds 64 KB.")
    }
  }

  const text = await c.req.text()
  const parsed = parseJsonBody(declared, text)

  if (!parsed.ok) {
    if (parsed.issue === "body-too-large") {
      throw new ValidationFailedError("Request body exceeds 64 KB.")
    }
    throw new InvalidJsonError()
  }

  return parsed.value
}

function describe(issues: readonly string[]): string {
  return `The request body is not valid: ${[...new Set(issues)].join(", ")}.`
}
