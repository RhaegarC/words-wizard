import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

/**
 * Doc-assertion: the service worker's runtime-caching table is build
 * configuration, not runtime code, so the durable property is read from the
 * file. A word image is an immutable URL, so it can be cached first and kept —
 * the same shape as the bundled art and the R2 objects.
 */

const config = readFileSync(
  new URL("../../../vite.config.ts", import.meta.url),
  "utf8",
)

describe("service worker runtime caching", () => {
  it("caches word images served by the API for offline use", () => {
    expect(config).toContain("urlPattern: /\\/v1\\/images\\//")
    expect(config).toContain('cacheName: "word-images"')
  })

  it("still caches bundled art first", () => {
    expect(config).toContain("handler: \"CacheFirst\"")
    expect(config).toContain('cacheName: "art"')
  })
})
