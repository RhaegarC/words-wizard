import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

/**
 * Bug 07. The browser checks installability when the page loads, so the
 * service worker must be registered at the application root — not behind the
 * signed-in boot that mounts App. The manifest is a no-cache network resource
 * and must not be pinned by the worker's precache.
 */

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8")
}

const main = read("../../main.tsx")
const app = read("../../App.tsx")
const vite = read("../../../vite.config.ts")

describe("PWA registration timing", () => {
  it("has the files under test", () => {
    expect(main).toContain("<App")
    expect(app).toContain("export default function App")
    expect(vite).toContain("VitePWA")
  })

  it("mounts UpdateProvider at the app root in main.tsx", () => {
    expect(main).toContain("UpdateProvider")
    expect(main).toMatch(
      /<UpdateProvider>[\s\S]*<App\s*\/>[\s\S]*<\/UpdateProvider>/,
    )
  })

  it("does not leave the provider behind App's signed-in boot gate", () => {
    expect(app).not.toContain("UpdateProvider")
  })

  it("does not precache the no-cache manifest", () => {
    const glob = /globPatterns:\s*\[([\s\S]*?)\]/.exec(vite)?.[1] ?? ""

    expect(glob).not.toContain("webmanifest")
    expect(glob).toContain('"icons/*.png"')
  })
})
