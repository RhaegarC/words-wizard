#!/usr/bin/env node
/**
 * Fail a release build that could not actually be served. This runs after
 * `vite build` and inspects `dist/` only: no network and no dependencies.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const dist = fileURLToPath(new URL("../../dist", import.meta.url))
const failures = []

function fail(message) {
  failures.push(message)
}

function requireFile(relative) {
  if (!existsSync(join(dist, relative))) {
    fail(`missing ${relative}`)
  }
}

function read(relative) {
  return readFileSync(join(dist, relative), "utf8")
}

function hashedFiles(extension) {
  if (!existsSync(join(dist, "assets"))) {
    return []
  }

  const hashed = /-[A-Za-z0-9_-]{8,}\./

  return readdirSync(join(dist, "assets")).filter(
    (name) => name.endsWith(extension) && hashed.test(name),
  )
}

function walk(directory) {
  if (!existsSync(directory)) {
    return []
  }

  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)

    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function parseHeaders(text) {
  const rules = []
  let current = null

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
      fail(`_headers: header line before any path (${line})`)
      continue
    }

    const separator = line.indexOf(":")

    if (separator === -1) {
      fail(`_headers: malformed line (${line})`)
      continue
    }

    current.headers.set(
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim(),
    )
  }

  return rules
}

/** The patterns are exact paths or a single trailing wildcard. */
function overlaps(a, b) {
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

for (const file of [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "_headers",
  "locales/en.json",
  "locales/zh.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
]) {
  requireFile(file)
}

if (hashedFiles(".js").length === 0) {
  fail("missing a hashed JavaScript asset in assets/")
}

if (hashedFiles(".css").length === 0) {
  fail("missing a hashed CSS asset in assets/")
}

if (existsSync(join(dist, "sw.js"))) {
  const worker = read("sw.js")

  if (!/precacheAndRoute|__WB_MANIFEST/.test(worker)) {
    fail("sw.js does not reference a Workbox precache manifest")
  }
}

const EXPECTED_HEADERS = new Map([
  ["/assets/*", "public, max-age=31536000, immutable"],
  ["/icons/*", "public, max-age=604800"],
  ["/art/*", "public, max-age=604800"],
  ["/favicon.svg", "public, max-age=604800"],
  ["/locales/*", "public, max-age=3600"],
  ["/", "no-cache"],
  ["/index.html", "no-cache"],
  ["/sw.js", "no-cache"],
  ["/registerSW.js", "no-cache"],
  ["/manifest.webmanifest", "no-cache"],
])

if (existsSync(join(dist, "_headers"))) {
  const rules = parseHeaders(read("_headers"))
  const byPattern = new Map(rules.map((rule) => [rule.pattern, rule]))

  for (const [pattern, expected] of EXPECTED_HEADERS) {
    const actual = byPattern.get(pattern)?.headers.get("cache-control")

    if (actual !== expected) {
      fail(`_headers: ${pattern} should be "${expected}", found "${actual}"`)
    }
  }

  for (let left = 0; left < rules.length; left += 1) {
    for (let right = left + 1; right < rules.length; right += 1) {
      const a = rules[left].pattern
      const b = rules[right].pattern

      if (overlaps(a, b)) {
        fail(`_headers: ${a} overlaps ${b}; Cache-Control would be joined`)
      }
    }
  }
}

if (existsSync(join(dist, "index.html"))) {
  const html = read("index.html")

  if (/(?:src|href)=["']\/assets\//.test(html)) {
    fail("index.html uses an absolute /assets/ URL; base should stay relative")
  }
}

if (existsSync(join(dist, "_redirects"))) {
  fail("_redirects is not used; every route is a hash fragment")
}

if (failures.length > 0) {
  console.error("check:dist failed")

  for (const failure of failures) {
    console.error(`  - ${failure}`)
  }

  process.exit(1)
}

const artwork = walk(dist).filter((path) => path.endsWith(".webp")).length

console.log(
  `check:dist passed — shell, hashed JS/CSS, locales, icons, _headers and ${artwork} artwork file(s)`,
)
