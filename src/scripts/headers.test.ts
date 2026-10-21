import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const headersUrl = new URL("../public/_headers", import.meta.url)

type Rule = {
  pattern: string
  headers: Map<string, string>
}

function parseHeaders(text: string): Rule[] {
  const rules: Rule[] = []
  let current: Rule | null = null

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()

    if (line === "" || line.startsWith("#")) {
      continue
    }

    if (!/^\s/.test(raw)) {
      current = { pattern: line, headers: new Map() }
      rules.push(current)
      continue
    }

    if (current === null) {
      throw new Error(`Header line before any path: ${line}`)
    }

    const separator = line.indexOf(":")

    if (separator === -1) {
      throw new Error(`Malformed header line: ${line}`)
    }

    current.headers.set(
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim(),
    )
  }

  return rules
}

/** The patterns are exact paths or a single trailing wildcard. */
function overlaps(a: string, b: string): boolean {
  const wildcardA = a.endsWith("*")
  const wildcardB = b.endsWith("*")

  if (!wildcardA && !wildcardB) {
    return a === b
  }

  if (wildcardA && wildcardB) {
    const prefixA = a.slice(0, -1)
    const prefixB = b.slice(0, -1)

    return prefixA.startsWith(prefixB) || prefixB.startsWith(prefixA)
  }

  const wildcard = wildcardA ? a : b
  const exact = wildcardA ? b : a

  return exact.startsWith(wildcard.slice(0, -1))
}

const rules = parseHeaders(readFileSync(headersUrl, "utf8"))

function cacheControl(pattern: string): string | undefined {
  return rules
    .find((rule) => rule.pattern === pattern)
    ?.headers.get("cache-control")
}

/**
 * Cloudflare applies every matching rule and comma-joins duplicate names, so
 * an overlapping pattern would produce two Cache-Control values. This is a
 * file-property test: deleting a rule or widening a wildcard turns it red.
 */
describe("public/_headers", () => {
  it("gives hashed assets a year of immutable caching", () => {
    expect(cacheControl("/assets/*")).toBe(
      "public, max-age=31536000, immutable",
    )
  })

  it("caches the icon set, artwork, and favicon for a week", () => {
    expect(cacheControl("/icons/*")).toBe("public, max-age=604800")
    expect(cacheControl("/art/*")).toBe("public, max-age=604800")
    expect(cacheControl("/favicon.svg")).toBe("public, max-age=604800")
  })

  it("caches locale JSON for an hour", () => {
    expect(cacheControl("/locales/*")).toBe("public, max-age=3600")
  })

  it("keeps the document, worker, and manifest revalidated", () => {
    for (const pattern of [
      "/",
      "/index.html",
      "/sw.js",
      "/registerSW.js",
      "/manifest.webmanifest",
    ]) {
      expect(cacheControl(pattern), pattern).toBe("no-cache")
    }
  })

  it("never lets one path inherit two cache classes", () => {
    for (let left = 0; left < rules.length; left += 1) {
      for (let right = left + 1; right < rules.length; right += 1) {
        const a = rules[left].pattern
        const b = rules[right].pattern

        expect(overlaps(a, b), `${a} overlaps ${b}`).toBe(false)
      }
    }
  })

  it("states a Cache-Control on every rule", () => {
    for (const rule of rules) {
      expect(rule.headers.get("cache-control"), rule.pattern).toBeTruthy()
    }
  })
})
