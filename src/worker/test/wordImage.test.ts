import { describe, expect, it } from "vitest"

import {
  MAX_WORD_IMAGE_BYTES,
  WORD_IMAGE_CACHE_CONTROL,
  isWordImageKey,
  keyFromImageUrl,
  wordImageKey,
  wordImageUrl,
} from "../wordImage"

/**
 * Unit tier: the word-image rules decided from strings alone. The stored type
 * comes from the avatar detector's magic-byte check, which is unit-tested in
 * `avatar.test.ts`; here the key shape and the derived URL are pinned.
 */

describe("wordImageKey", () => {
  it("keeps the word under a fresh immutable object key", () => {
    expect(wordImageKey("w-brave", "0c9f", "webp")).toBe(
      "word-images/w-brave/0c9f.webp",
    )
    expect(wordImageKey("w-ice-cream-2", "a1b2", "jpg")).toBe(
      "word-images/w-ice-cream-2/a1b2.jpg",
    )
  })
})

describe("isWordImageKey", () => {
  it("accepts only keys the upload route could have written", () => {
    expect(isWordImageKey("word-images/w-brave/0c9f.png")).toBe(true)
    expect(isWordImageKey("word-images/w-brave/0c9f.jpg")).toBe(true)
    expect(isWordImageKey("word-images/w-brave/0c9f.webp")).toBe(true)
  })

  it("refuses another prefix, a traversal, and an unaccepted extension", () => {
    for (const key of [
      "avatars/oid-1/0c9f.png",
      "word-images/../secret.png",
      "word-images/w-brave/../../etc/passwd",
      "/word-images/w-brave/0c9f.png",
      "art/word-images/w-brave/0c9f.png",
      "word-images/w-brave/0c9f.gif",
      "word-images/w-brave/0c9f",
      "word-images/w-brave/nested/0c9f.png",
      "word-images//0c9f.png",
      "word-images/w-brave/.png",
      "word-images/w brave/0c9f.png",
    ]) {
      expect(isWordImageKey(key), key).toBe(false)
    }
  })
})

describe("wordImageUrl", () => {
  it("derives the public URL from the request origin and the key", () => {
    expect(wordImageUrl("http://localhost:8787", "word-images/w-brave/0c9f.png")).toBe(
      "http://localhost:8787/v1/images/word-images/w-brave/0c9f.png",
    )
    expect(wordImageUrl("https://wordsapi.nioh.uk", "word-images/w/a.webp")).toBe(
      "https://wordsapi.nioh.uk/v1/images/word-images/w/a.webp",
    )
  })
})

describe("keyFromImageUrl", () => {
  it("reads back the key this worker wrote", () => {
    expect(
      keyFromImageUrl(
        "http://localhost:8787/v1/images/word-images/w-brave/0c9f.png",
      ),
    ).toBe("word-images/w-brave/0c9f.png")
  })

  it("refuses a URL whose path is not a word-image key", () => {
    for (const url of [
      "https://example.test/word-images/w-brave/0c9f.png",
      "https://example.test/v1/images/avatars/oid-1/0c9f.png",
      "https://example.test/v1/images/word-images/w-brave/0c9f.gif",
      "https://example.test/?next=/v1/images/word-images/w-brave/0c9f.png",
      "not a url",
      "ftp://example.test/v1/images/word-images/w-brave/0c9f.png",
    ]) {
      expect(keyFromImageUrl(url), url).toBeNull()
    }
  })
})

describe("caps", () => {
  it("matches the avatar limits", () => {
    expect(MAX_WORD_IMAGE_BYTES).toBe(2 * 1024 * 1024)
    expect(WORD_IMAGE_CACHE_CONTROL).toBe(
      "public, max-age=31536000, immutable",
    )
  })
})
