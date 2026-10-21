#!/usr/bin/env node
/**
 * Post-deploy smoke check. Requests the deployed URL and proves Cloudflare is
 * serving the document, a hashed asset, and artwork with the headers declared
 * in `_headers`. Runs after `wrangler pages deploy`, with the same Node.
 */
import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const dist = fileURLToPath(new URL("../dist", import.meta.url))
const baseUrl = (
  process.argv[2] ??
  process.env.DEPLOY_URL ??
  "https://words-wizard.pages.dev"
).replace(/\/$/, "")

const failures = []
const attempts = 6
const retryDelayMs = 5000

function fail(message) {
  failures.push(message)
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

function hashedAsset() {
  const assets = join(dist, "assets")

  if (!existsSync(assets)) {
    return null
  }

  const name = readdirSync(assets).find(
    (entry) => entry.endsWith(".js") && /-[A-Za-z0-9_-]{8,}\./.test(entry),
  )

  return name === undefined ? null : `/assets/${name}`
}

function firstArtwork() {
  const path = walk(dist).find((entry) => entry.endsWith(".webp"))

  if (!path) {
    return null
  }

  return `/${path.slice(dist.length + 1).split("\\").join("/")}`
}

async function fetchWithRetry(url) {
  let lastError

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, { redirect: "follow" })
    } catch (error) {
      lastError = error

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      }
    }
  }

  throw lastError
}

async function check(path, expectations) {
  const url = `${baseUrl}${path}`
  let response

  try {
    response = await fetchWithRetry(url)
  } catch (error) {
    fail(`${path}: request failed (${String(error)})`)
    return
  }

  if (response.status !== 200) {
    fail(`${path}: expected 200, got ${response.status}`)
    return
  }

  const headers = response.headers

  for (const [name, expected] of Object.entries(expectations)) {
    const actual = headers.get(name) ?? ""

    if (!actual.toLowerCase().includes(expected.toLowerCase())) {
      fail(`${path}: expected ${name} to contain "${expected}", got "${actual}"`)
    }
  }

  console.log(`ok ${path} — ${response.status} ${headers.get("cache-control")}`)
}

const asset = hashedAsset()
const artwork = firstArtwork()

if (asset === null) {
  fail("no hashed JavaScript asset in dist/assets")
}

if (artwork === null) {
  fail("no .webp artwork in dist; final illustrations land in feature 17")
}

await check("/", {
  "content-type": "text/html",
  "cache-control": "no-cache",
})

if (asset !== null) {
  await check(asset, {
    "content-type": "javascript",
    "cache-control": "immutable",
  })
}

if (artwork !== null) {
  await check(artwork, {
    "content-type": "image/webp",
    "cache-control": "max-age=604800",
  })
}

if (failures.length > 0) {
  console.error(`check:deploy failed for ${baseUrl}`)

  for (const failure of failures) {
    console.error(`  - ${failure}`)
  }

  process.exit(1)
}

console.log(`check:deploy passed for ${baseUrl}`)
