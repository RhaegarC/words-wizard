import { spawnSync, type SpawnSyncReturns } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

/**
 * Remote D1 tier, gated on test-only credentials.
 *
 * The names are deliberately distinct from the application's own so a
 * developer with a production Cloudflare token in their shell cannot make a
 * test run migrate or write anything real. Absent credentials skip visibly;
 * once a database is named, a refused migration is a failure.
 *
 * Run with: `pnpm test:db:remote`
 */

const srcRoot = fileURLToPath(new URL("../..", import.meta.url))
const wranglerBin = join(srcRoot, "node_modules", "wrangler", "bin", "wrangler.js")
const drizzleDir = join(srcRoot, "worker", "drizzle")

const TOKEN = process.env.WORDS_TEST_CLOUDFLARE_API_TOKEN
const ACCOUNT = process.env.WORDS_TEST_CLOUDFLARE_ACCOUNT_ID
const DATABASE_ID = process.env.WORDS_TEST_D1_DATABASE_ID
const configuredBool = Boolean(TOKEN && ACCOUNT && DATABASE_ID)

const TIMEOUT = 120_000

let configPath: string

function wrangler(args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    [wranglerBin, ...args, "--remote", "--config", configPath],
    {
      cwd: srcRoot,
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: TOKEN,
        CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
        CI: "true",
        WRANGLER_SEND_METRICS: "false",
      },
      encoding: "utf8",
    },
  )
}

function output(result: SpawnSyncReturns<string>): string {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`
}

function query<T>(sql: string): T[] {
  const result = wrangler(["d1", "execute", "DB", "--command", sql, "--json"])

  if (result.status !== 0) {
    throw new Error(`remote d1 execute failed\n${output(result)}`)
  }

  const json = result.stdout.slice(result.stdout.indexOf("["))
  const parsed = JSON.parse(json) as Array<{ results: T[] }>

  return parsed[0]?.results ?? []
}

describe.skipIf(!configuredBool)(
  "remote D1 tier (set WORDS_TEST_CLOUDFLARE_API_TOKEN, WORDS_TEST_CLOUDFLARE_ACCOUNT_ID, WORDS_TEST_D1_DATABASE_ID)",
  () => {
    beforeAll(() => {
      const dir = mkdtempSync(join(tmpdir(), "words-wizard-remote-"))
      configPath = join(dir, "wrangler.test.json")
      writeFileSync(
        configPath,
        JSON.stringify({
          name: "words-wizard-test",
          main: join(srcRoot, "worker", "index.ts"),
          compatibility_date: "2025-01-01",
          d1_databases: [
            {
              binding: "DB",
              database_name: "words-wizard-test",
              database_id: DATABASE_ID,
              migrations_dir: drizzleDir,
            },
          ],
        }),
      )
    }, TIMEOUT)

    afterAll(() => {
      if (configPath !== undefined) {
        rmSync(dirname(configPath), { recursive: true, force: true })
      }
    })

    it(
      "applies the same migration set Cloudflare's engine will run",
      () => {
        const result = wrangler(["d1", "migrations", "apply", "DB"])

        expect(result.status, output(result)).toBe(0)
        expect(
          query<{ content_version: string }>(
            "SELECT content_version FROM content_meta WHERE id = 1",
          )[0]?.content_version,
        ).toBe("0.3.0")
      },
      TIMEOUT,
    )

    it(
      "enforces the level check on the remote engine",
      () => {
        const result = wrangler([
          "d1",
          "execute",
          "DB",
          "--command",
          "INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES ('remote-level-check', 'remote-level-check', '/x/', 'noun', 'm', 'm', 'd', 'd', '[{\"en\":\"x\",\"zh\":\"x\"}]', NULL, NULL, 4, '[]', 0, 0, NULL);",
          "--json",
        ])

        expect(output(result)).toMatch(/constraint failed/i)
        expect(
          query<{ present: number }>(
            "SELECT COUNT(*) AS present FROM words WHERE id = 'remote-level-check'",
          )[0]?.present,
        ).toBe(0)
      },
      TIMEOUT,
    )

    it(
      "migrates the user tables and enforces the profile locale check",
      () => {
        const tables = query<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table'",
        ).map((row) => row.name)

        for (const table of [
          "users",
          "profiles",
          "progress",
          "pack_introductions",
          "metrics",
          "sessions",
          "session_metrics",
          "metric_events",
        ]) {
          expect(tables).toContain(table)
        }

        const oid = `remote-locale-${Date.now()}`
        query(
          `INSERT INTO users (oid, created_at, last_seen_at) VALUES ('${oid}', 0, 0);`,
        )
        const result = wrangler([
          "d1",
          "execute",
          "DB",
          "--command",
          `INSERT INTO profiles (user_id, character_name, avatar, current_topic_id, xp, created_at, last_practice_at, last_wake_at, frozen_days, care_tokens, sessions_since_last_token, completed_sessions, streak_count, best_streak, last_streak_date, last_monthly_review_at, locale) VALUES ('${oid}', 'Hero', 'alex', NULL, 0, 0, 0, NULL, 0, 0, 0, 0, 0, 0, NULL, NULL, 'fr');`,
          "--json",
        ])

        expect(output(result)).toMatch(/constraint failed/i)
        expect(
          query<{ present: number }>(
            `SELECT COUNT(*) AS present FROM profiles WHERE user_id = '${oid}'`,
          )[0]?.present,
        ).toBe(0)

        query(`DELETE FROM users WHERE oid = '${oid}';`)
      },
      TIMEOUT,
    )

    it(
      "enforces the session_metrics composite foreign key on the remote engine",
      () => {
        const oid = `remote-fk-${Date.now()}`
        query(
          `INSERT INTO users (oid, created_at, last_seen_at) VALUES ('${oid}', 0, 0);`,
        )
        const result = wrangler([
          "d1",
          "execute",
          "DB",
          "--command",
          `INSERT INTO session_metrics (user_id, session_id, name, delta) VALUES ('${oid}', 'missing-session', 'sessionCompleted', 1);`,
          "--json",
        ])

        expect(output(result)).toMatch(/constraint failed/i)
        expect(
          query<{ present: number }>(
            `SELECT COUNT(*) AS present FROM session_metrics WHERE user_id = '${oid}'`,
          )[0]?.present,
        ).toBe(0)

        query(`DELETE FROM users WHERE oid = '${oid}';`)
      },
      TIMEOUT,
    )

    it(
      "keeps the case-insensitive headword index",
      () => {
        const indexes = query<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'index'",
        ).map((row) => row.name)

        expect(indexes).toContain("words_text_nocase")
      },
      TIMEOUT,
    )
  },
)
