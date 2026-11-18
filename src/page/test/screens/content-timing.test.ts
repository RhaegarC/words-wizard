import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

/**
 * The content bundle is fetched during boot, after the module graph has been
 * evaluated. A screen that snapshots it in a top-level `const` keeps the empty
 * pre-boot bundle for the life of the page, so every stored progress row is
 * joined against no words and disappears: exactly the empty My Words
 * collection bug 06 describes. Screens must read these accessors while
 * rendering.
 */

const screensDir = fileURLToPath(new URL("../../screens/", import.meta.url))

const CONTENT_ACCESSOR =
  /^const\s+[A-Z0-9_]+\s*=\s*get(?:HomeContent|AllWords|AllPacks|Topics|AvatarSet|Topic|Pack|Word|WordsByIds|WordsByTopic)\(\)\s*$/

function screenFiles(): string[] {
  return readdirSync(screensDir).filter((name) => name.endsWith(".tsx"))
}

describe("screens and the online content bundle", () => {
  it("has screens to check", () => {
    expect(screenFiles().length).toBeGreaterThan(5)
  })

  it("reads content when rendering, not when the module is imported", () => {
    const offenders: string[] = []

    for (const name of screenFiles()) {
      const source = readFileSync(join(screensDir, name), "utf8")

      for (const line of source.split("\n")) {
        if (CONTENT_ACCESSOR.test(line.trim())) {
          offenders.push(`${name}: ${line.trim()}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
