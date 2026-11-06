import type { Context } from "hono"

import type { AppEnv } from "./context"
import { InvalidJsonError, ValidationFailedError } from "./errors"
import { MAX_BODY_BYTES, parseJsonBody } from "./profileInput"

/**
 * Read the body once, refusing a declared oversize before the text is
 * touched and the actual byte length before `JSON.parse`.
 *
 * Both the user-data routes and the admin write routes use this, so the size
 * guard and the invalid-JSON answer cannot drift between them.
 */
export async function readBody(
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
