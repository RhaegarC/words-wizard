#!/usr/bin/env node
/**
 * Post-deploy smoke check for the Pages app and the Worker API.
 *
 * Usage:
 *   node page/scripts/check-deploy.mjs [pagesUrl] [workerUrl]
 *
 * Defaults:
 *   pagesUrl  = PAGES_URL  or https://words.nioh.uk
 *   workerUrl = WORKER_URL or https://wordsapi.nioh.uk
 *
 * Set EXPECTED_CONTENT_VERSION to fail on a release whose content version does
 * not match. Set ALLOWED_ORIGIN to override the CORS origin (defaults to the
 * Pages origin, which is what the Worker allowlist contains in production).
 */
import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const dist = fileURLToPath(new URL("../../dist", import.meta.url))

function withoutTrailingSlash(value) {
  return value.replace(/\/+$/, "")
}

const pagesBaseUrl = withoutTrailingSlash(
  process.argv[2] ?? process.env.PAGES_URL ?? "https://words.nioh.uk",
)
const workerBaseUrl = withoutTrailingSlash(
  process.argv[3] ?? process.env.WORKER_URL ?? "https://wordsapi.nioh.uk",
)
const allowedOrigin = withoutTrailingSlash(
  process.env.ALLOWED_ORIGIN ?? pagesBaseUrl,
)
const expectedContentVersion = (process.env.EXPECTED_CONTENT_VERSION ?? "").trim()

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

async function fetchWithRetry(url, options = {}) {
  let lastError

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, { redirect: "follow", ...options })
    } catch (error) {
      lastError = error

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      }
    }
  }

  throw lastError
}

async function request(baseUrl, path, options) {
  try {
    return await fetchWithRetry(`${baseUrl}${path}`, options)
  } catch (error) {
    fail(`${baseUrl}${path}: request failed (${String(error)})`)
    return null
  }
}

async function checkPages(path, expectations) {
  const response = await request(pagesBaseUrl, path)
  if (response === null) return

  if (response.status !== 200) {
    fail(`${path}: expected 200, got ${response.status}`)
    return
  }

  for (const [name, expected] of Object.entries(expectations)) {
    const actual = response.headers.get(name) ?? ""

    if (!actual.toLowerCase().includes(expected.toLowerCase())) {
      fail(`${path}: expected ${name} to contain "${expected}", got "${actual}"`)
    }
  }

  console.log(
    `ok ${path} — ${response.status} ${response.headers.get("cache-control")}`,
  )
}

async function checkWorker() {
  const healthResponse = await request(workerBaseUrl, "/health")
  if (healthResponse === null) return

  if (healthResponse.status !== 200) {
    fail(`/health: expected 200, got ${healthResponse.status}`)
    return
  }

  let health

  try {
    health = await healthResponse.json()
  } catch {
    fail("/health: response is not JSON")
    return
  }

  if (health.ok !== true) {
    fail(`/health: expected { ok: true }, got ${JSON.stringify(health)}`)
    return
  }

  if (typeof health.contentVersion !== "string" || health.contentVersion === "") {
    fail("/health: contentVersion must be a non-empty string")
    return
  }

  if (
    expectedContentVersion !== "" &&
    health.contentVersion !== expectedContentVersion
  ) {
    fail(
      `/health: stale content version "${health.contentVersion}", expected "${expectedContentVersion}"`,
    )
  }

  const contentResponse = await request(workerBaseUrl, "/v1/content", {
    headers: { Origin: allowedOrigin },
  })
  if (contentResponse === null) return

  if (contentResponse.status !== 200) {
    fail(`/v1/content: expected 200, got ${contentResponse.status}`)
    return
  }

  const cors = contentResponse.headers.get("access-control-allow-origin")
  if (cors !== allowedOrigin) {
    fail(
      `/v1/content: expected access-control-allow-origin "${allowedOrigin}", got "${cors ?? "none"}"`,
    )
  }

  let content

  try {
    content = await contentResponse.json()
  } catch {
    fail("/v1/content: response is not JSON")
    return
  }

  const contentVersion = content?.meta?.contentVersion
  if (typeof contentVersion !== "string" || contentVersion === "") {
    fail("/v1/content: meta.contentVersion must be a non-empty string")
    return
  }

  if (contentVersion !== health.contentVersion) {
    fail(
      `/v1/content: stale content version "${contentVersion}", /health reports "${health.contentVersion}"`,
    )
  }

  const etag = contentResponse.headers.get("etag")
  if (etag !== `"${contentVersion}"`) {
    fail(
      `/v1/content: expected ETag "${`"${contentVersion}"`}", got "${etag ?? "none"}"`,
    )
  }

  const unlisted = await request(workerBaseUrl, "/v1/content", {
    headers: { Origin: "https://unlisted.invalid" },
  })

  if (unlisted !== null) {
    const unlistedCors = unlisted.headers.get("access-control-allow-origin")
    if (unlistedCors !== null) {
      fail(
        `/v1/content: unlisted origin received access-control-allow-origin "${unlistedCors}"`,
      )
    }
  }

  console.log(
    `ok /health and /v1/content — ${health.contentVersion}, CORS ${allowedOrigin}`,
  )
}

const asset = hashedAsset()
const artwork = firstArtwork()

if (asset === null) {
  fail("no hashed JavaScript asset in dist/assets")
}

if (artwork === null) {
  console.log("note no .webp artwork in dist; word art lands in feature 17")
}

await checkPages("/", {
  "content-type": "text/html",
  "cache-control": "no-cache",
})

if (asset !== null) {
  await checkPages(asset, {
    "content-type": "javascript",
    "cache-control": "immutable",
  })
}

if (artwork !== null) {
  await checkPages(artwork, {
    "content-type": "image/webp",
    "cache-control": "max-age=604800",
  })
}

await checkWorker()

if (failures.length > 0) {
  console.error(`check:deploy failed for ${pagesBaseUrl} and ${workerBaseUrl}`)

  for (const failure of failures) {
    console.error(`  - ${failure}`)
  }

  process.exit(1)
}

console.log(
  `check:deploy passed for ${pagesBaseUrl} and ${workerBaseUrl}${expectedContentVersion === "" ? "" : ` (content ${expectedContentVersion})`}`,
)
