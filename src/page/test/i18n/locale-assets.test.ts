import { readdirSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const pageRoot = new URL("../../", import.meta.url)

const SOURCE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/

/** Every import form vite's import analysis sees: `from`, bare, dynamic. */
const IMPORT =
  /(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+)["']/g

function sourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    // public/ is copied verbatim; nothing in it is a module to scan.
    if (entry.name === "public" || entry.name === "node_modules") {
      return []
    }

    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory)

    if (entry.isDirectory()) {
      return sourceFiles(child)
    }

    return SOURCE.test(entry.name) ? [child] : []
  })
}

/**
 * Vite copies `public/` verbatim and refuses to import it from JavaScript: the
 * same file would be served twice, once bundled and once as a static URL.
 * Locale dictionaries are imported so `t()` stays synchronous, so they live
 * under `i18n/locales/` and the build emits the served copies from there.
 * Reintroducing an import from `public/` brings the console warning back.
 */
describe("page modules", () => {
  it("never import an asset from public/", () => {
    const offenders: string[] = []

    for (const file of sourceFiles(pageRoot)) {
      const source = readFileSync(file, "utf8")

      for (const match of source.matchAll(IMPORT)) {
        if (/(?:^|\/)public\//.test(match[1])) {
          offenders.push(`${file.pathname}: ${match[1]}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it("keeps the imported locale dictionaries under i18n/", () => {
    for (const locale of ["en", "zh"]) {
      expect(
        readFileSync(new URL(`../../i18n/locales/${locale}.json`, import.meta.url), "utf8"),
      ).toContain('"')
    }
  })
})
