import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

/**
 * Feature 38 is a removal/consolidation: no component-test tier exists for the
 * screens, so the durable claims are asserted against the source, the locale
 * catalogue and the documentation that the change owns.
 */

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url))

function read(relative: string): string {
  return readFileSync(join(repoRoot, relative), "utf8")
}

function source(relative: string): Record<string, unknown> {
  return JSON.parse(read(relative)) as Record<string, unknown>
}

describe("export and diagnostics are gone", () => {
  it("no longer ships their modules or tests", () => {
    for (const path of [
      "src/page/components/SettingsDiagnostics.tsx",
      "src/page/db/diagnostics.ts",
      "src/shared/diagnostics.ts",
      "src/page/i18n/metrics.ts",
      "src/page/download.ts",
      "src/shared/export.ts",
      "src/shared/test/export.test.ts",
      "src/shared/test/diagnostics.test.ts",
    ]) {
      expect(existsSync(join(repoRoot, path)), path).toBe(false)
    }
  })

  it("removes the cards and handlers from the profile screen", () => {
    const settings = read("src/page/screens/SettingsScreen.tsx")

    expect(settings).not.toMatch(
      /SettingsDiagnostics|buildExport|downloadJson|exportBackup|exporting/,
    )
  })

  it("keeps the version for the About card", () => {
    expect(existsSync(join(repoRoot, "src/shared/app.ts"))).toBe(true)
    expect(read("src/shared/app.ts")).toContain("APP_VERSION")
    expect(read("src/page/screens/SettingsScreen.tsx")).toContain(
      "APP_VERSION",
    )
  })
})

describe("the badge shelf lives in the profile page", () => {
  it("moves the catalogue and removes the standalone screen and home card", () => {
    expect(existsSync(join(repoRoot, "src/page/components/BadgeShelf.tsx"))).toBe(
      true,
    )
    expect(
      existsSync(join(repoRoot, "src/page/screens/BadgesScreen.tsx")),
    ).toBe(false)
    expect(
      existsSync(join(repoRoot, "src/page/components/BadgeShelfCard.tsx")),
    ).toBe(false)

    const settings = read("src/page/screens/SettingsScreen.tsx")
    expect(settings).toContain("BadgeShelf")

    const home = read("src/page/screens/HomeScreen.tsx")
    expect(home).not.toContain("BadgeShelfCard")
    expect(home).not.toContain('id: "badges"')
    expect(home).not.toContain('className="icon-button"')

    const routes = read("src/page/router/routes.ts")
    expect(routes).not.toContain('"badges"')

    const app = read("src/page/App.tsx")
    expect(app).not.toContain("BadgesScreen")
  })
})

describe("the profile links and rename", () => {
  it("uses ProfileLink on Home and in the shell top bar", () => {
    expect(read("src/page/screens/HomeScreen.tsx")).toContain("ProfileLink")
    expect(read("src/page/shell/AppShell.tsx")).toContain("ProfileLink")
  })

  it("renames the visible page and drops the dead keys", () => {
    const en = source("src/page/i18n/locales/en.json")
    const zh = source("src/page/i18n/locales/zh.json")

    expect(en["settings.heading"]).toBe("Profile")
    expect(en["settings.eyebrow"]).toBe("Your profile")
    expect(en["common.screen.settings"]).toBe("Profile")
    expect(zh["settings.heading"]).toBe("个人资料")
    expect(zh["common.screen.settings"]).toBe("个人资料")

    for (const key of [
      "settings.export",
      "settings.exportHint",
      "settings.exporting",
      "settings.exportError",
      "settings.diagnostics",
      "settings.diagnosticsHint",
      "home.settings",
      "home.badgesTitle",
      "home.badgesEmpty",
      "home.badgesNext",
      "common.screen.badges",
    ]) {
      expect(en, key).not.toHaveProperty(key)
      expect(zh, key).not.toHaveProperty(key)
    }

    expect(
      Object.keys(en).filter((key) => key.startsWith("settings.counter.")),
    ).toEqual([])
    expect(en["badges.title"]).toBeTruthy()
  })
})

describe("the database bootstrap section", () => {
  it("documents local and production initialisation", () => {
    const worker = read("docs/develop/worker.md")

    expect(worker).toContain("## Initialise the database from scratch")
    expect(worker).toContain("scripts/words.sql")
    expect(worker).toContain("scripts/InitData.sql")
    expect(worker).toContain("content_meta")
    expect(worker).toContain("backup/20261118.sql")
    expect(worker).toContain(
      "npx wrangler d1 migrations apply DB --remote --config worker/wrangler.jsonc && npx wrangler deploy --config worker/wrangler.jsonc",
    )
  })

  it("updates the page doc from a display-only chip to the Profile link", () => {
    const page = read("docs/develop/page.md")

    expect(page).not.toContain("display-only")
    expect(page).toContain("Profile")
  })
})
