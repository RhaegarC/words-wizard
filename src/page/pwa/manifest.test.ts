import { existsSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const publicDir = new URL("../public/", import.meta.url)

type Manifest = {
  name: string
  short_name: string
  start_url: string
  scope: string
  display: string
  theme_color: string
  background_color: string
  icons: { src: string; sizes: string; purpose: string }[]
}

const manifest = JSON.parse(
  readFileSync(new URL("manifest.webmanifest", publicDir), "utf8"),
) as Manifest

/**
 * The manifest is installed by the browser, not rendered by the app, so this is
 * a doc assertion: it protects the durable shape the stores read at install.
 */
describe("manifest.webmanifest", () => {
  it("names the product in English and Chinese", () => {
    expect(manifest.name).toContain("Words Wizard")
    expect(manifest.name).toContain("单词巫师")
    expect(manifest.short_name).toBe("单词巫师")
  })

  it("opens and scopes the app relative to wherever it is hosted", () => {
    expect(manifest.start_url).toBe("./")
    expect(manifest.scope).toBe("./")
    expect(manifest.display).toBe("standalone")
  })

  it("carries the theme colours the shell uses", () => {
    expect(manifest.theme_color).toBe("#7059dc")
    expect(manifest.background_color).toBe("#fbfaf7")
  })

  it("ships 192, 512, and maskable icons that exist", () => {
    const bySize = (size: string, purpose: string) =>
      manifest.icons.find(
        (icon) => icon.sizes === size && icon.purpose === purpose,
      )

    expect(bySize("192x192", "any")).toBeDefined()
    expect(bySize("512x512", "any")).toBeDefined()
    expect(bySize("512x512", "maskable")).toBeDefined()

    for (const icon of manifest.icons) {
      expect(existsSync(new URL(icon.src, publicDir)), icon.src).toBe(true)
    }
  })
})
