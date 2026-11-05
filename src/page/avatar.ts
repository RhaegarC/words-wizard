/**
 * Presentation helpers for a stored avatar. The key is server-generated; the
 * URL is composed from configuration so production can use the bucket's public
 * domain and local development the Worker's own route.
 */

const AVATAR_KEY = /^avatars\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(?:png|jpg|webp)$/

/** The public URL for a stored key, or null when there is no usable key. */
export function avatarUrl(
  baseUrl: string,
  key: string | null | undefined,
): string | null {
  if (key === null || key === undefined || !AVATAR_KEY.test(key)) return null

  return `${baseUrl.replace(/\/+$/, "")}/${key}`
}

/** The first code point of a display name, uppercased; `?` when empty. */
export function avatarInitials(name: string): string {
  const trimmed = name.trim()
  if (trimmed === "") return "?"

  return [...trimmed][0]!.toUpperCase()
}
