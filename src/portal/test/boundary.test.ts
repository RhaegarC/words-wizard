import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

/**
 * The portal is a second application, not a second entry point into the child
 * app. It may reuse the pure auth modules — config, MSAL, token, account,
 * session — but never the child provider, content provider, outbox, or API
 * client, and the child app never imports the portal.
 */

const portalRoot = fileURLToPath(new URL("../", import.meta.url))
const pageRoot = fileURLToPath(new URL("../../page/", import.meta.url))
const srcRoot = fileURLToPath(new URL("../../", import.meta.url))

const ALLOWED_PAGE_MODULES = new Set([
  "auth/config",
  "auth/msal",
  "auth/token",
  "auth/account",
  "auth/session",
])

function sourceFiles(root: string, skip = "test"): string[] {
  return readdirSync(root).flatMap((name) => {
    if (name === skip || name === "node_modules") return []

    const path = join(root, name)

    if (statSync(path).isDirectory()) return sourceFiles(path, skip)

    return /\.(?:ts|tsx)$/.test(name) && !name.endsWith(".test.ts")
      ? [path]
      : []
  })
}

function specifiers(file: string): string[] {
  const text = readFileSync(file, "utf8")
  const matches = text.matchAll(
    /(?:from\s+|import\s*)["']([^"']+)["']/g,
  )

  return [...matches].map((match) => match[1])
}

describe("the portal's imports", () => {
  const files = sourceFiles(portalRoot)

  it("has a real application to check", () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it("reuses only the pure auth modules from the child app", () => {
    const problems: string[] = []

    for (const file of files) {
      for (const specifier of specifiers(file)) {
        const pageModule = /^(?:\.\.\/)+page\/(.+)$/.exec(specifier)

        if (pageModule !== null && !ALLOWED_PAGE_MODULES.has(pageModule[1]!)) {
          problems.push(`${file}: ${specifier}`)
        }

        if (specifier.startsWith("@/")) {
          problems.push(`${file}: the child-app alias ${specifier}`)
        }
      }
    }

    expect(problems).toEqual([])
  })

  it("is never imported by the child app", () => {
    const problems: string[] = []

    for (const file of sourceFiles(pageRoot)) {
      for (const specifier of specifiers(file)) {
        if (
          /(?:^|\/)portal\//.test(specifier) ||
          specifier.startsWith("@/portal")
        ) {
          problems.push(`${file}: ${specifier}`)
        }
      }
    }

    expect(problems).toEqual([])
  })
})

describe("the portal's build", () => {
  function read(relative: string): string {
    return readFileSync(join(srcRoot, relative), "utf8")
  }

  it("has its own Vite config on port 8444 and its own output directory", () => {
    const config = read("vite.portal.config.ts")

    expect(config).toContain("portal")
    expect(config).toContain("8444")
    expect(config).toContain("../dist-portal")
  })

  it("leaves the child app's output directory alone", () => {
    const config = read("vite.config.ts")

    expect(config).toContain("../dist")
    expect(config).not.toContain("dist-portal")
  })

  it("is built and typechecked by the package scripts", () => {
    const packageJson = read("package.json")

    expect(packageJson).toContain('"dev:portal"')
    expect(packageJson).toContain('"build:portal"')
    expect(packageJson).toContain("tsconfig.portal.json")
  })

  it("is built by the existing CI workflow", () => {
    const ci = readFileSync(
      join(srcRoot, "..", ".github", "workflows", "ci.yml"),
      "utf8",
    )

    expect(ci).toContain("pnpm build:portal")
  })

  it("keeps the admin output out of the repository", () => {
    const ignore = readFileSync(join(srcRoot, "..", ".gitignore"), "utf8")

    expect(ignore).toContain("dist-portal/")
  })
})
