import type { Context, Hono, MiddlewareHandler } from "hono"

import { MAX_IMPORT_BODY_BYTES, parseLegacyImport } from "../shared/legacyImport"
import { validateServerSessionPayload } from "../shared/sessionPayload"
import type { ServerSessionCommitPayload } from "../shared/sessionPayload"

import {
  AVATAR_CACHE_CONTROL,
  MAX_AVATAR_BYTES,
  avatarKey,
  detectImageType,
} from "./avatar"
import { requireAuth } from "./auth"
import type { TokenVerifier } from "./auth"
import type { WorkerConfig } from "./config"
import { requireAvatars, requireDb } from "./config"
import type { AppEnv } from "./context"
import {
  avatarExists,
  clearUserAvatar,
  commitSession,
  createProfile,
  ensureUser,
  importLegacyData,
  patchProfile,
  readMe,
  readProfile,
  setUserAvatar,
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

    const principal = c.get("principal")
    await ensureUser(db, principal.oid, principal, Date.now())
    return c.json(await readMe(db, principal.oid))
  })

  app.post("/v1/me/profile", async (c) => {
    const parsed = parseCreateProfile(await readBody(c), Date.now())
    if (!parsed.ok) throw new ValidationFailedError(describe(parsed.issues))

    const db = requireDb(c.env)
    const principal = c.get("principal")
    const input = parsed.value

    // The allowlists are rows, not constants: an id is accepted only if D1 has it.
    if (!(await avatarExists(db, input.avatar))) {
      throw new ValidationFailedError("Unknown avatar.")
    }
    if (
      input.currentTopicId !== null &&
      !(await topicExists(db, input.currentTopicId))
    ) {
      throw new ValidationFailedError("Unknown topic.")
    }

    await ensureUser(db, principal.oid, principal, input.now)
    const result = await createProfile(
      db,
      principal.oid,
      { ...input, role: principal.role },
      input.now,
    )

    return c.json(result.profile, result.created ? 201 : 200)
  })

  app.patch("/v1/me/profile", async (c) => {
    const parsed = parseProfilePatch(await readBody(c))
    if (!parsed.ok) throw new ValidationFailedError(describe(parsed.issues))

    const db = requireDb(c.env)
    const principal = c.get("principal")
    const oid = principal.oid
    const patch = parsed.value

    await ensureUser(db, oid, principal, Date.now())
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
    const principal = c.get("principal")
    const oid = principal.oid
    const now = Date.now()

    await ensureUser(db, oid, principal, now)
    return c.json(
      await commitSession(db, oid, payload as ServerSessionCommitPayload, now),
    )
  })

  app.post("/v1/me/metrics", async (c) => {
    const parsed = parseMetricEvent(await readBody(c))
    if (!parsed.ok) throw new ValidationFailedError(describe(parsed.issues))

    const db = requireDb(c.env)
    const principal = c.get("principal")
    const oid = principal.oid
    const now = Date.now()

    await ensureUser(db, oid, principal, now)
    return c.json(await writeMetric(db, oid, parsed.value, now))
  })

  app.post("/v1/me/import", async (c) => {
    // A whole Mission 1 history is larger than the other routes' bodies.
    const parsed = parseLegacyImport(
      await readBody(c, MAX_IMPORT_BODY_BYTES),
    )
    if (!parsed.ok) throw new ValidationFailedError(describe(parsed.issues))

    const db = requireDb(c.env)
    const principal = c.get("principal")
    const now = Date.now()

    await ensureUser(db, principal.oid, principal, now)
    return c.json(await importLegacyData(db, principal.oid, parsed.value))
  })

  app.post("/v1/me/care", async (c) => {
    const parsed = parseCareEvent(await readBody(c))
    if (!parsed.ok) throw new ValidationFailedError(describe(parsed.issues))

    const db = requireDb(c.env)
    const principal = c.get("principal")
    const oid = principal.oid
    const now = Date.now()

    await ensureUser(db, oid, principal, now)
    const profile = await applyCare(
      db,
      oid,
      parsed.value.action,
      parsed.value.eventId,
      now,
    )
    return c.json({ profile })
  })

  app.post("/v1/me/avatar", async (c) => {
    const db = requireDb(c.env)
    const bucket = requireAvatars(c.env)
    const principal = c.get("principal")
    const now = Date.now()

    // A multipart wrapper is larger than the file; refuse an obviously large
    // body before parsing it, then the exact file size after.
    const declared = c.req.header("content-length")
    if (declared !== undefined) {
      const size = Number(declared)
      if (
        Number.isFinite(size) &&
        size > MAX_AVATAR_BYTES + MULTIPART_OVERHEAD
      ) {
        throw new ValidationFailedError("The image exceeds 2 MB.")
      }
    }

    let form: Record<string, string | File>
    try {
      form = await c.req.parseBody()
    } catch {
      throw new ValidationFailedError(
        "The request must be multipart/form-data.",
      )
    }

    const file = form["file"]
    if (!(file instanceof File)) {
      throw new ValidationFailedError("Attach exactly one `file` field.")
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new ValidationFailedError("The image exceeds 2 MB.")
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const detected = detectImageType(bytes)
    if (detected === null) {
      throw new ValidationFailedError(
        "Only JPEG, PNG, and WebP images are accepted.",
      )
    }

    await ensureUser(db, principal.oid, principal, now)
    const profile = await readProfile(db, principal.oid)
    if (profile === null) throw new ProfileNotFoundError()

    const key = avatarKey(principal.oid, crypto.randomUUID(), detected.ext)
    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType: detected.mime,
        cacheControl: AVATAR_CACHE_CONTROL,
      },
    })

    if (!(await setUserAvatar(db, principal.oid, key))) {
      // The row vanished between the read and the update: do not leave an
      // object no row points at.
      await bucket.delete(key).catch(() => undefined)
      throw new ProfileNotFoundError()
    }

    if (profile.user_avatar_key !== null) {
      await bucket.delete(profile.user_avatar_key).catch(() => undefined)
    }

    return c.json({ key })
  })

  app.delete("/v1/me/avatar", async (c) => {
    const db = requireDb(c.env)
    const bucket = requireAvatars(c.env)
    const principal = c.get("principal")

    await ensureUser(db, principal.oid, principal, Date.now())
    const profile = await readProfile(db, principal.oid)
    if (profile === null) throw new ProfileNotFoundError()

    // The row is the source of truth; a failed object delete leaves only an
    // unreferenced object, never a broken key.
    await clearUserAvatar(db, principal.oid)
    if (profile.user_avatar_key !== null) {
      await bucket.delete(profile.user_avatar_key).catch(() => undefined)
    }

    return c.body(null, 204)
  })
}

/** Room for multipart boundaries and part headers around the 2 MiB file. */
const MULTIPART_OVERHEAD = 64 * 1024

/**
 * Read the body once, refusing a declared oversize before the text is
 * touched and the actual byte length before `JSON.parse`.
 */
async function readBody(
  c: Context<AppEnv>,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<unknown> {
  const declared = c.req.header("content-length")

  if (declared !== undefined) {
    const size = Number(declared)
    if (Number.isFinite(size) && size > maxBytes) {
      throw new ValidationFailedError(bodyTooLarge(maxBytes))
    }
  }

  const text = await c.req.text()
  const parsed = parseJsonBody(declared, text, maxBytes)

  if (!parsed.ok) {
    if (parsed.issue === "body-too-large") {
      throw new ValidationFailedError(bodyTooLarge(maxBytes))
    }
    throw new InvalidJsonError()
  }

  return parsed.value
}

/** Name the applicable limit rather than a hard-coded 64 KB. */
function bodyTooLarge(maxBytes: number): string {
  return `Request body exceeds ${Math.round(maxBytes / 1024)} KB.`
}

function describe(issues: readonly string[]): string {
  return `The request body is not valid: ${[...new Set(issues)].join(", ")}.`
}
