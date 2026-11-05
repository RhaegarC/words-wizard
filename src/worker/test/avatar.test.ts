import { describe, expect, it } from "vitest"

import {
  AVATAR_CACHE_CONTROL,
  MAX_AVATAR_BYTES,
  avatarKey,
  detectImageType,
  isAvatarKey,
} from "../avatar"

/**
 * Unit tier: the avatar rules decided from bytes and strings alone. The host
 * tier proves the same rules through the multipart route and R2.
 */

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
])

const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
])

const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
])

describe("detectImageType", () => {
  it("recognises the three accepted formats from their magic bytes", () => {
    expect(detectImageType(PNG)).toEqual({ mime: "image/png", ext: "png" })
    expect(detectImageType(JPEG)).toEqual({ mime: "image/jpeg", ext: "jpg" })
    expect(detectImageType(WEBP)).toEqual({ mime: "image/webp", ext: "webp" })
  })

  it("does not trust an extension or a declared content type", () => {
    // A GIF, a PDF header, and text are all refused regardless of name.
    expect(
      detectImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])),
    ).toBeNull()
    expect(detectImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull()
    expect(detectImageType(new TextEncoder().encode("not an image"))).toBeNull()
  })

  it("refuses a truncated payload", () => {
    expect(detectImageType(new Uint8Array([]))).toBeNull()
    expect(detectImageType(PNG.slice(0, 4))).toBeNull()
    expect(detectImageType(WEBP.slice(0, 10))).toBeNull()
  })

  it("does not accept a RIFF container that is not WebP", () => {
    const riffWave = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ])

    expect(detectImageType(riffWave)).toBeNull()
  })

  it("caps uploads at two mebibytes", () => {
    expect(MAX_AVATAR_BYTES).toBe(2 * 1024 * 1024)
  })
})

describe("avatarKey", () => {
  it("scopes the key to the identity and appends the detected extension", () => {
    expect(avatarKey("oid-1", "0c9f", "webp")).toBe("avatars/oid-1/0c9f.webp")
  })

  it("uses the immutable cache directive the public route serves", () => {
    expect(AVATAR_CACHE_CONTROL).toBe("public, max-age=31536000, immutable")
  })
})

describe("isAvatarKey", () => {
  it("accepts only the key shape the upload route writes", () => {
    expect(isAvatarKey("avatars/oid-1/0c9f.webp")).toBe(true)
    expect(isAvatarKey("avatars/oid-1/0c9f.jpg")).toBe(true)
    expect(isAvatarKey("avatars/oid-1/0c9f.png")).toBe(true)
  })

  it("refuses traversal, a leading slash, another prefix, or another type", () => {
    for (const key of [
      "avatars/../secret.png",
      "/avatars/oid-1/0c9f.png",
      "avatars/oid-1/../../etc/passwd",
      "art/avatars/oid-1/0c9f.png",
      "avatars/oid-1/0c9f.gif",
      "avatars/oid-1/0c9f",
      "avatars/oid-1/nested/0c9f.png",
      "avatars/oid-1/.png",
      "",
    ]) {
      expect(isAvatarKey(key), key).toBe(false)
    }
  })
})
