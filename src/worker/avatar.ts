/**
 * Avatar rules decided from bytes and strings alone.
 *
 * The declared content type and the filename are never trusted: a caller can
 * claim `image/png` for anything. Only the magic bytes decide the stored type,
 * and only a key this module would have written is read back publicly.
 */

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export const AVATAR_CACHE_CONTROL = "public, max-age=31536000, immutable"

export type AvatarExtension = "png" | "jpg" | "webp"

export interface DetectedImage {
  readonly mime: "image/png" | "image/jpeg" | "image/webp"
  readonly ext: AvatarExtension
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50] // "WEBP" at offset 8

/** The type of an accepted image, or null for anything else. */
export function detectImageType(bytes: Uint8Array): DetectedImage | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return { mime: "image/png", ext: "png" }
  }

  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return { mime: "image/jpeg", ext: "jpg" }
  }

  // A WebP is a RIFF container whose form type at offset 8 is "WEBP"; a RIFF
  // of another kind (WAVE, AVI) is not an image.
  if (
    startsWith(bytes, RIFF_SIGNATURE) &&
    bytes.length >= 12 &&
    startsWith(bytes.subarray(8), WEBP_SIGNATURE)
  ) {
    return { mime: "image/webp", ext: "webp" }
  }

  return null
}

export function avatarKey(
  oid: string,
  id: string,
  ext: AvatarExtension,
): string {
  return `avatars/${oid}/${id}.${ext}`
}

const AVATAR_KEY = /^avatars\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(?:png|jpg|webp)$/

/** True only for a key `avatarKey` could have produced. */
export function isAvatarKey(key: string): boolean {
  return AVATAR_KEY.test(key)
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false

  return prefix.every((value, index) => bytes[index] === value)
}
