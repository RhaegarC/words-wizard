import { existsSync, readFileSync, readdirSync } from "node:fs"

import { describe, expect, it } from "vitest"

const repoRoot = new URL("../../../", import.meta.url)
const publicDir = new URL("../public/", import.meta.url)
const scriptsDir = new URL("../scripts/", import.meta.url)
const workflowsDir = new URL(".github/workflows/", repoRoot)
const ciUrl = new URL("ci.yml", workflowsDir)
const workersDoc = new URL("docs/deploy/worker.md", repoRoot)
const pagesDoc = new URL("docs/deploy/page.md", repoRoot)
const operationsDoc = new URL("docs/operations.md", repoRoot)
const privacyDoc = new URL("docs/privacy.md", repoRoot)
const readme = new URL("README.md", repoRoot)
const prd = new URL("docs/PRD.md", repoRoot)
const backlog = new URL("docs/features/backlog.md", repoRoot)
const checkDeploy = new URL("check-deploy.mjs", scriptsDir)
const wrangler = new URL("worker/wrangler.jsonc", new URL("../../", import.meta.url))

function read(url: URL): string {
  return readFileSync(url, "utf8")
}

function workflows(): string[] {
  return readdirSync(workflowsDir).filter(
    (name) => name.endsWith(".yml") || name.endsWith(".yaml"),
  )
}

/**
 * Configuration and documentation the suite cannot execute: Cloudflare owns the
 * deployment, so these assertions protect the durable contract in the files.
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
      "pnpm build",
      "pnpm check:dist",
    ]) {
      expect(ci, step).toContain(step)
    }
  })

  it("runs the remote D1 tier only with test-only credentials", () => {
    const ci = read(ciUrl)

    expect(ci).toContain("test:db:remote")
    expect(ci).toContain("WORDS_TEST_CLOUDFLARE_API_TOKEN")
    expect(ci).toContain("WORDS_TEST_CLOUDFLARE_ACCOUNT_ID")
    expect(ci).toContain("WORDS_TEST_D1_DATABASE_ID")
    expect(ci).toContain("skipped")

    // A production Cloudflare token must never be a CI secret.
    expect(ci).not.toContain("secrets.CLOUDFLARE_API_TOKEN")
    expect(ci).not.toContain("secrets.CLOUDFLARE_ACCOUNT_ID")
  })

  it("leaves deployment to Cloudflare's Git integration", () => {
    const names = workflows()

    expect(names).not.toContain("deploy.yml")

    for (const name of names) {
      const text = read(new URL(name, workflowsDir))

      expect(text, name).not.toContain("wrangler pages deploy")
      expect(text, name).not.toContain("pages deploy")

      // The preview-cleanup job is not a deployment: it deletes preview
      // deployments after a merge and can never publish one. It is the only
      // workflow allowed the account's credentials, and only to delete.
      if (name === "delete-preview.yml") {
        expect(text, name).toContain("-X DELETE")
        continue
      }

      expect(text, name).not.toContain("secrets.CLOUDFLARE_API_TOKEN")
      expect(text, name).not.toContain("secrets.CLOUDFLARE_ACCOUNT_ID")
    }
  })

  it("records the Worker Builds migration contract", () => {
    const doc = read(workersDoc)
    const config = read(wrangler)

    expect(doc).toContain(
      "wrangler d1 migrations apply DB --remote --config worker/wrangler.jsonc && wrangler deploy --config worker/wrangler.jsonc",
    )
    expect(config).toContain('"migrations_dir": "drizzle"')
    expect(config).toContain('"pattern": "wordsapi.nioh.uk"')
  })

  it("checks the Pages origin, the Worker health, and CORS after deploy", () => {
    const script = read(checkDeploy)

    expect(script).toContain("words.nioh.uk")
    expect(script).toContain("wordsapi.nioh.uk")
    expect(script).toContain("/health")
    expect(script).toContain("contentVersion")
    expect(script).toContain("access-control-allow-origin")
    expect(script).toContain("EXPECTED_CONTENT_VERSION")
  })
})

describe("documentation truth", () => {
  it("records the production operations and deletion procedure", () => {
    const doc = read(operationsDoc)

    expect(doc).toContain("Wrangler")
    expect(doc).toContain("wrangler d1 migrations apply")
    expect(doc).toContain("PRAGMA foreign_key_check")
    expect(doc).toContain("WORDS_TEST_CLOUDFLARE_API_TOKEN")
    expect(doc).toContain("DELETE FROM users")
    expect(doc).toContain("oid")
    expect(doc).toContain("explicit approval")
  })

  it("states the privacy boundary", () => {
    const doc = read(privacyDoc)

    expect(doc).toContain("oid")
    expect(doc).toContain("Cloudflare D1")
    expect(doc).toContain("We do not store")
    expect(doc).toContain("Deletion")
  })

  it("publishes PRD v0.3 with the online architecture", () => {
    const doc = read(prd)

    expect(doc).toContain("**Version:** 0.3")
    expect(doc).toContain("online-only")
    expect(doc).toContain("Cloudflare D1")
    expect(doc).not.toContain("**Version:** 0.2")
  })

  it("documents local development, the tiers, and the deploy path", () => {
    const doc = read(readme)

    expect(doc).toContain("VITE_ENTRA_CLIENT_ID")
    expect(doc).toContain("VITE_API_BASE_URL")
    expect(doc).toContain("pnpm worker:dev")
    expect(doc).toContain("pnpm test:db:remote")
    expect(doc).toContain("pnpm check:deploy")
    expect(doc).toContain("migrations apply DB --local")
  })

  it("points production setup at the Pages environment and the Worker topology", () => {
    const pages = read(pagesDoc)
    const workers = read(workersDoc)

    expect(pages).toContain("VITE_ENTRA_CLIENT_ID")
    expect(pages).toContain("VITE_API_BASE_URL")
    expect(pages).toContain("dist")
    expect(workers).toContain("Root directory")
    expect(workers).toContain("src")
  })

  it("keeps Mission 1 historical and in the archive", () => {
    expect(
      existsSync(
        new URL("docs/features/archive/00-mission-1-sprint.md", repoRoot),
      ),
    ).toBe(true)
    expect(
      existsSync(new URL("docs/features/00-mission-1-sprint.md", repoRoot)),
    ).toBe(false)
  })

  it("no longer rejects accounts or cloud sync in the backlog", () => {
    const doc = read(backlog)

    expect(doc).not.toContain("Accounts, sign-in, or cloud backup")
    expect(doc).toContain("Offline practice")
  })
})
