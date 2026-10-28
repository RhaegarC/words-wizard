import { existsSync, readFileSync, readdirSync } from "node:fs"

import { describe, expect, it } from "vitest"

const repoRoot = new URL("../../../", import.meta.url)
const publicDir = new URL("../public/", import.meta.url)
const scriptsDir = new URL("../scripts/", import.meta.url)
const workflowsDir = new URL(".github/workflows/", repoRoot)
const ciUrl = new URL("ci.yml", workflowsDir)

function read(url: URL): string {
  return readFileSync(url, "utf8")
}

function workflows(): string[] {
  return readdirSync(workflowsDir).filter(
    (name) => name.endsWith(".yml") || name.endsWith(".yaml"),
  )
}

/**
 * Configuration the suite cannot execute: the hash router needs no server
 * rewrite, and Cloudflare's Git integration — not a GitHub workflow — owns the
 * deployment. These assertions protect those durable properties of the files.
 */
describe("deployment configuration", () => {
  it("ships no _redirects file, because every route is a fragment", () => {
    expect(existsSync(new URL("_redirects", publicDir))).toBe(false)
  })

  it("runs the full check set on pull requests to develop", () => {
    const ci = read(ciUrl)

    expect(ci).toContain("pull_request:")
    expect(ci).toContain("develop")
    expect(ci).toContain("working-directory: src")

    for (const step of [
      "pnpm install --frozen-lockfile",
      "pnpm typecheck",
      "pnpm test",
      "pnpm validate:content",
      "pnpm build",
      "pnpm check:dist",
    ]) {
      expect(ci, step).toContain(step)
    }
  })

  it("leaves deployment to Cloudflare's Git integration", () => {
    const names = workflows()

    expect(names).not.toContain("deploy.yml")

    for (const name of names) {
      const text = read(new URL(name, workflowsDir))

      expect(text, name).not.toContain("wrangler pages deploy")
      expect(text, name).not.toContain("CLOUDFLARE_API_TOKEN")
      expect(text, name).not.toContain("CLOUDFLARE_ACCOUNT_ID")
    }
  })

  it("keeps an on-demand post-deploy smoke check", () => {
    expect(existsSync(new URL("check-deploy.mjs", scriptsDir))).toBe(true)
  })
})
