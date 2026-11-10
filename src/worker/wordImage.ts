import type { AvatarExtension } from "./avatar"

/**
 * Word-image rules decided from strings alone (feature 31).
 *
 * The uploaded file's type is decided by the avatar pipeline's magic-byte
 * detector, never by the declared content type or the filename. This module
 * owns only what is specific to a word: the key shape, the derived public URL,
 * and the path back from a stored URL to the object to delete.
 *
 * A key is `<prefix>/<wordId>/<uuid>.<ext>`. Only keys this shape allows are
 * read back publicly, so `..`, another prefix, or an unaccepted extension is
 * refused before R2 is touched.
 */

export const MAX_WORD_IMAGE_BYTES = 2 * 1024 * 1024

export const WORD_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable"

export type WordImageExtension = AvatarExtension

export function wordImageKey(
  wordId: string,
  id: string,
  ext: WordImageExtension,
): string {
  return `word-images/${wordId}/${id}.${ext}`
}

const WORD_IMAGE_KEY =
  /^word-images\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(?:png|jpg|webp)$/

/** True only for a key `wordImageKey` could have produced. */
export function isWordImageKey(key: string): boolean {
  return WORD_IMAGE_KEY.test(key)
}

/**
 * The stored URL is derived from the request origin, so local development
 * stores `localhost` and production stores the public API host without any
 * extra configuration.
 */
export function wordImageUrl(origin: string, key: string): string {
  return `${origin}/v1/images/${key}`
}

/**
 * The object key a stored URL points at, or null when the URL is not one this
 * worker could have written (an authored import, another host, a bad shape).
 */
export function keyFromImageUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null

  const prefix = "/v1/images/"
  if (!parsed.pathname.startsWith(prefix)) return null

  const key = parsed.pathname.slice(prefix.length)
  return isWordImageKey(key) ? key : null
}
