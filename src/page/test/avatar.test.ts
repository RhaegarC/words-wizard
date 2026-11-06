import { describe, expect, it } from "vitest"

import { avatarInitials, avatarUrl } from "../avatar"

/**
 * Unit tier: the page's avatar helpers. The bytes are stored by the Worker; the
 * page only turns the stored key into a URL and a missing key into initials.
 */

describe("avatarUrl", () => {
  it("joins the base and the stored key", () => {
    expect(
      avatarUrl("https://avatars.example.test", "avatars/oid-1/abc.png"),
    ).toBe("https://avatars.example.test/avatars/oid-1/abc.png")
  })

  it("ignores a trailing slash on the base", () => {
    expect(
      avatarUrl("http://localhost:8787/v1/avatars/", "avatars/a/b.webp"),
    ).toBe("http://localhost:8787/v1/avatars/avatars/a/b.webp")
  })

  it("returns null without a key", () => {
    expect(avatarUrl("https://avatars.example.test", null)).toBeNull()
    expect(avatarUrl("https://avatars.example.test", undefined)).toBeNull()
    expect(avatarUrl("https://avatars.example.test", "")).toBeNull()
  })

  it("refuses a key that is not server-shaped", () => {
    for (const key of [
      "/etc/passwd",
      "avatars/../../secret.png",
      "art/avatars/a/b.png",
      "https://evil.test/a.png",
    ]) {
      expect(avatarUrl("https://avatars.example.test", key), key).toBeNull()
    }
  })
})

describe("avatarInitials", () => {
  it("uses the first code point, uppercased", () => {
    expect(avatarInitials("Mia")).toBe("M")
    expect(avatarInitials("  cody")).toBe("C")
  })

  it("handles a non-Latin name and an empty name", () => {
    expect(avatarInitials("小明")).toBe("小")
    expect(avatarInitials("   ")).toBe("?")
  })
})
