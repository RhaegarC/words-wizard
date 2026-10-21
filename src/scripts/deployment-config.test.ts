import { existsSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const repoRoot = new URL("../../", import.meta.url)
const publicDir = new URL("../public/", import.meta.url)
const ciUrl = new URL(".github/workflows/ci.yml", repoRoot)
const deployUrl = new URL(".github/workflows/deploy.yml", repoRoot)

function read(url: URL): string {
  return readFileSync(url, "utf8")
}

/**
 * Configuration the suite cannot execute: the hash router needs no server
 * rewrite, and a preview deployment would publish the dev dataset's worker.
 * These assertions protect those durable properties of the files.
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

  it("deploys the prebuilt dist from master on push or dispatch", () => {
    const deploy = read(deployUrl)

    expect(deploy).toContain("workflow_dispatch:")
    expect(deploy).toMatch(/push:\s*\n\s*branches:\s*\n?\s*-\s*master/)
    expect(deploy).toContain("contents: read")
    expect(deploy).toContain(
      "wrangler pages deploy dist --project-name words-wizard --branch master",
    )
    expect(deploy).toContain("pnpm build")
    expect(deploy).toContain("pnpm check:dist")
    expect(deploy).toContain("pnpm check:deploy")
  })

  it("never configures a pull-request preview deployment", () => {
    expect(read(deployUrl)).not.toContain("pull_request:")
  })

  it("reads deployment credentials only from repository secrets", () => {
    const deploy = read(deployUrl)

    expect(deploy).toContain("secrets.CLOUDFLARE_API_TOKEN")
    expect(deploy).toContain("secrets.CLOUDFLARE_ACCOUNT_ID")
    expect(deploy).not.toMatch(/CLOUDFLARE_API_TOKEN\s*[:=]\s*["'][^$]/)
  })
})
