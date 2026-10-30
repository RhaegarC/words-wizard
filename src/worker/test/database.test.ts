import { spawnSync, type SpawnSyncReturns } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

/**
 * Database tier: the real local D1 engine behind `wrangler d1`.
 *
 * The migration set is applied once for the run and every assertion is
 * row-scoped to ids this file writes. Skip-vs-fail is not a distinction here:
 * the engine is local and always reachable, so a migration that will not apply
 * or a constraint that does not fire is a failure.
 */

const srcRoot = fileURLToPath(new URL("../..", import.meta.url))
const wranglerBin = join(srcRoot, "node_modules", "wrangler", "bin", "wrangler.js")
const workerConfig = join(srcRoot, "worker", "wrangler.jsonc")

const TIMEOUT = 60_000

let persistDir: string

function wrangler(args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    [
      wranglerBin,
      ...args,
      "--local",
      "--persist-to",
      persistDir,
      "--config",
      workerConfig,
    ],
    {
      cwd: srcRoot,
      env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
      encoding: "utf8",
    },
  )
}

function migrate(): SpawnSyncReturns<string> {
  return wrangler(["d1", "migrations", "apply", "DB"])
}

function execute(sql: string): SpawnSyncReturns<string> {
  return wrangler(["d1", "execute", "DB", "--command", sql, "--json"])
}

function output(result: SpawnSyncReturns<string>): string {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`
}

function query<T>(sql: string): T[] {
  const result = execute(sql)

  if (result.status !== 0) {
    throw new Error(`d1 execute failed\n${output(result)}`)
  }

  const json = (result.stdout ?? "").slice(result.stdout.indexOf("["))
  const parsed = JSON.parse(json) as Array<{ results: T[] }>

  return parsed[0]?.results ?? []
}

/**
 * A refused write. Wrangler versions differ on whether a constraint violation
 * exits non-zero, so the claim is the one that matters: the engine reports a
 * constraint failure and the row is not there.
 */
function expectRefused(sql: string, rowCheck: string): void {
  const result = execute(sql)
  const text = output(result)

  expect(`${result.status === 0 ? "ok" : "failed"} ${text}`).toMatch(
    /constraint failed/i,
  )
  expect(query<{ present: number }>(rowCheck)[0]?.present).toBe(0)
}

function topicInsert(id: string, sortOrder = 1): string {
  return `INSERT INTO topics (id, title, title_zh, icon, description, description_zh, sort_order, created_at, updated_at) VALUES ('${id}', 'T', 'T', '🔤', 'd', 'd', ${sortOrder}, 0, 0);`
}

function packInsert(id: string, topicId: string, sortOrder = 1): string {
  return `INSERT INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('${id}', '${topicId}', 'P', 'P', ${sortOrder}, 0, 0);`
}

function wordInsert(
  id: string,
  overrides: Partial<{
    text: string
    level: number
    examples: string
    tags: string
    archivedAt: number | null
  }> = {},
): string {
  const text = overrides.text ?? id
  const level = overrides.level ?? 1
  const examples = overrides.examples ?? '[{"en":"It works.","zh":"它有用。"}]'
  const tags = overrides.tags ?? "[]"
  const archivedAt =
    overrides.archivedAt === undefined || overrides.archivedAt === null
      ? "NULL"
      : String(overrides.archivedAt)

  return `INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES ('${id}', '${text}', '/x/', 'noun', 'm', 'm', 'd', 'd', '${examples}', NULL, NULL, ${level}, '${tags}', 0, 0, ${archivedAt});`
}

beforeAll(() => {
  persistDir = mkdtempSync(join(tmpdir(), "words-wizard-d1-"))

  const result = migrate()

  if (result.status !== 0) {
    throw new Error(`migrations apply failed\n${output(result)}`)
  }
}, 120_000)

afterAll(() => {
  rmSync(persistDir, { recursive: true, force: true })
})

describe("migrations", () => {
  it(
    "creates the content tables and the indexes the model declares",
    () => {
      const tables = query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      ).map((row) => row.name)

      for (const table of [
        "avatar_stages",
        "avatars",
        "content_meta",
        "pack_words",
        "packs",
        "topics",
        "words",
      ]) {
        expect(tables).toContain(table)
      }

      expect(tables).not.toContain("word_topics")
      expect(tables).not.toContain("word_examples")
      expect(tables).not.toContain("artwork")

      const indexes = query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index'",
      ).map((row) => row.name)

      expect(indexes).toEqual(
        expect.arrayContaining([
          "words_text_nocase",
          "packs_topic",
          "pack_words_pack_word",
          "pack_words_word",
        ]),
      )
    },
    TIMEOUT,
  )

  it(
    "seeds content_meta, eight avatars, and five stages each",
    () => {
      const meta = query<{
        schema_version: number
        dataset: string
        content_version: string
      }>("SELECT schema_version, dataset, content_version FROM content_meta")

      expect(meta).toEqual([
        { schema_version: 1, dataset: "dev", content_version: "0.3.0" },
      ])

      expect(
        query<{ count: number }>("SELECT COUNT(*) AS count FROM avatars")[0]
          ?.count,
      ).toBe(8)
      expect(
        query<{ count: number }>(
          "SELECT COUNT(*) AS count FROM avatar_stages",
        )[0]?.count,
      ).toBe(40)
    },
    TIMEOUT,
  )

  it(
    "re-applies the set as a no-op",
    () => {
      const result = migrate()

      expect(result.status).toBe(0)
      expect(output(result)).toMatch(/no migrations to apply/i)
      expect(
        query<{ count: number }>("SELECT COUNT(*) AS count FROM avatars")[0]
          ?.count,
      ).toBe(8)
    },
    TIMEOUT,
  )
})

describe("content_meta", () => {
  it(
    "refuses a second meta row",
    () => {
      expectRefused(
        "INSERT INTO content_meta (id, schema_version, dataset, content_version) VALUES (2, 1, 'dev', 'extra');",
        "SELECT COUNT(*) AS present FROM content_meta WHERE id = 2",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses a dataset outside dev and final",
    () => {
      expectRefused(
        "UPDATE content_meta SET dataset = 'staging' WHERE id = 1;",
        "SELECT COUNT(*) AS present FROM content_meta WHERE dataset = 'staging'",
      )
    },
    TIMEOUT,
  )
})

describe("words", () => {
  it(
    "round-trips a row and re-reads it in a fresh command",
    () => {
      execute(wordInsert("db-word-roundtrip", { text: "roundtrip" }))

      expect(
        query<{ id: string; text: string; level: number }>(
          "SELECT id, text, level FROM words WHERE id = 'db-word-roundtrip'",
        ),
      ).toEqual([{ id: "db-word-roundtrip", text: "roundtrip", level: 1 }])
    },
    TIMEOUT,
  )

  it(
    "refuses a level outside 1, 2, or 3",
    () => {
      expectRefused(
        wordInsert("db-word-level", { level: 4 }),
        "SELECT COUNT(*) AS present FROM words WHERE id = 'db-word-level'",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses examples that are not JSON",
    () => {
      expectRefused(
        wordInsert("db-word-examples", { examples: "not json" }),
        "SELECT COUNT(*) AS present FROM words WHERE id = 'db-word-examples'",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses tags that are not JSON",
    () => {
      expectRefused(
        wordInsert("db-word-tags", { tags: "{" }),
        "SELECT COUNT(*) AS present FROM words WHERE id = 'db-word-tags'",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses a headword that differs only in case",
    () => {
      execute(wordInsert("db-word-case-a", { text: "Alpha" }))

      expectRefused(
        wordInsert("db-word-case-b", { text: "alpha" }),
        "SELECT COUNT(*) AS present FROM words WHERE id = 'db-word-case-b'",
      )
    },
    TIMEOUT,
  )

  it(
    "keeps an archived word as a row",
    () => {
      execute(wordInsert("db-word-archived", { archivedAt: 1 }))

      expect(
        query<{ archived_at: number }>(
          "SELECT archived_at FROM words WHERE id = 'db-word-archived'",
        ),
      ).toEqual([{ archived_at: 1 }])
    },
    TIMEOUT,
  )
})

function userInsert(oid: string): string {
  return `INSERT INTO users (oid, created_at, last_seen_at) VALUES ('${oid}', 0, 0);`
}

function profileInsert(
  oid: string,
  overrides: Partial<{ locale: string; xp: number; currentTopicId: string | null }> = {},
): string {
  const locale = overrides.locale ?? "en"
  const xp = overrides.xp ?? 0
  const topic = overrides.currentTopicId ?? null

  return `INSERT INTO profiles (user_id, character_name, avatar, current_topic_id, xp, created_at, last_practice_at, last_wake_at, frozen_days, care_tokens, sessions_since_last_token, completed_sessions, streak_count, best_streak, last_streak_date, last_monthly_review_at, locale)
VALUES ('${oid}', 'Hero', 'alex', ${topic === null ? "NULL" : `'${topic}'`}, ${xp}, 0, 0, NULL, 0, 0, 0, 0, 0, 0, NULL, NULL, '${locale}');`
}

function progressInsert(
  oid: string,
  wordId: string,
  overrides: Partial<{ status: string; strength: number }> = {},
): string {
  const status = overrides.status ?? "learning"
  const strength = overrides.strength ?? 0.5

  return `INSERT INTO progress (user_id, word_id, status, strength, next_review_at, correct_count, wrong_count, first_seen_at, last_seen_at, mastery_xp_awarded)
VALUES ('${oid}', '${wordId}', '${status}', ${strength}, 0, 0, 0, 0, 0, 0);`
}

function sessionInsert(oid: string, id: string, kind = "daily"): string {
  return `INSERT INTO sessions (id, user_id, kind, local_date, content_version, xp_earned, finished_at, created_at)
VALUES ('${id}', '${oid}', '${kind}', '2026-10-30', '0.3.0', 0, 0, 0);`
}

describe("user tables", () => {
  it(
    "creates the eight user tables",
    () => {
      const tables = query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      ).map((row) => row.name)

      for (const table of [
        "metric_events",
        "metrics",
        "pack_introductions",
        "profiles",
        "progress",
        "session_metrics",
        "sessions",
        "users",
      ]) {
        expect(tables).toContain(table)
      }
    },
    TIMEOUT,
  )

  it(
    "refuses a profile with no user row",
    () => {
      expectRefused(
        profileInsert("db-orphan-profile"),
        "SELECT COUNT(*) AS present FROM profiles WHERE user_id = 'db-orphan-profile'",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses a locale outside en and zh",
    () => {
      execute(userInsert("db-user-locale"))

      expectRefused(
        profileInsert("db-user-locale", { locale: "fr" }),
        "SELECT COUNT(*) AS present FROM profiles WHERE user_id = 'db-user-locale'",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses a progress status or strength outside the declared range",
    () => {
      execute(userInsert("db-user-progress"))
      execute(wordInsert("db-word-progress"))

      expectRefused(
        progressInsert("db-user-progress", "db-word-progress", {
          status: "started",
        }),
        "SELECT COUNT(*) AS present FROM progress WHERE user_id = 'db-user-progress' AND status = 'started'",
      )
      expectRefused(
        progressInsert("db-user-progress", "db-word-progress", {
          strength: 1.1,
        }),
        "SELECT COUNT(*) AS present FROM progress WHERE user_id = 'db-user-progress' AND strength > 1",
      )
      expectRefused(
        progressInsert("db-user-progress", "db-word-progress", {
          strength: -0.1,
        }),
        "SELECT COUNT(*) AS present FROM progress WHERE user_id = 'db-user-progress' AND strength < 0",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses progress whose word does not exist",
    () => {
      execute(userInsert("db-user-word-fk"))

      expectRefused(
        progressInsert("db-user-word-fk", "db-word-missing"),
        "SELECT COUNT(*) AS present FROM progress WHERE user_id = 'db-user-word-fk'",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses a session kind outside daily and monthly",
    () => {
      execute(userInsert("db-user-kind"))
      execute(sessionInsert("db-user-kind", "db-session-ok"))

      expectRefused(
        sessionInsert("db-user-kind", "db-session-bad", "weekly"),
        "SELECT COUNT(*) AS present FROM sessions WHERE id = 'db-session-bad'",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses session_metrics without the composite session key",
    () => {
      execute(userInsert("db-user-session-metric"))

      expectRefused(
        "INSERT INTO session_metrics (user_id, session_id, name, delta) VALUES ('db-user-session-metric', 'db-session-missing', 'session.completed', 1);",
        "SELECT COUNT(*) AS present FROM session_metrics WHERE user_id = 'db-user-session-metric'",
      )
    },
    TIMEOUT,
  )

  it(
    "cascades every user-owned row when the user is deleted",
    () => {
      execute(userInsert("db-user-cascade"))
      execute(wordInsert("db-word-cascade"))
      execute(topicInsert("db-topic-cascade"))
      execute(packInsert("db-pack-cascade", "db-topic-cascade"))
      execute(profileInsert("db-user-cascade"))
      execute(progressInsert("db-user-cascade", "db-word-cascade"))
      execute(sessionInsert("db-user-cascade", "db-session-cascade"))
      execute(
        "INSERT INTO session_metrics (user_id, session_id, name, delta) VALUES ('db-user-cascade', 'db-session-cascade', 'session.completed', 1);",
      )
      execute(
        "INSERT INTO pack_introductions (user_id, pack_id, word_id, introduced_at) VALUES ('db-user-cascade', 'db-pack-cascade', 'db-word-cascade', 0);",
      )
      execute(
        "INSERT INTO metrics (user_id, name, value, updated_at) VALUES ('db-user-cascade', 'session.completed', 1, 0);",
      )
      execute(
        "INSERT INTO metric_events (user_id, event_id, name, delta, created_at) VALUES ('db-user-cascade', 'event-1', 'care.freeze', 1, 0);",
      )

      execute("DELETE FROM users WHERE oid = 'db-user-cascade';")

      for (const table of [
        "profiles",
        "progress",
        "pack_introductions",
        "metrics",
        "sessions",
        "session_metrics",
        "metric_events",
      ]) {
        expect(
          query<{ present: number }>(
            `SELECT COUNT(*) AS present FROM ${table} WHERE user_id = 'db-user-cascade'`,
          )[0]?.present,
          table,
        ).toBe(0)
      }

      // Content is untouched: an introduction's word and pack survive.
      expect(
        query<{ present: number }>(
          "SELECT COUNT(*) AS present FROM words WHERE id = 'db-word-cascade'",
        )[0]?.present,
      ).toBe(1)
    },
    TIMEOUT,
  )

  it(
    "refuses deleting a word that a user's progress still references",
    () => {
      execute(userInsert("db-user-word-delete"))
      execute(wordInsert("db-word-delete"))
      execute(progressInsert("db-user-word-delete", "db-word-delete"))

      // Content never cascades: the word survives and the delete is refused.
      const result = execute("DELETE FROM words WHERE id = 'db-word-delete';")

      expect(output(result)).toMatch(/constraint failed/i)
      expect(
        query<{ present: number }>(
          "SELECT COUNT(*) AS present FROM words WHERE id = 'db-word-delete'",
        )[0]?.present,
      ).toBe(1)
    },
    TIMEOUT,
  )
})

describe("packs and pack_words", () => {
  it(
    "refuses a pack whose topic does not exist",
    () => {
      expectRefused(
        packInsert("db-pack-orphan", "db-topic-missing"),
        "SELECT COUNT(*) AS present FROM packs WHERE id = 'db-pack-orphan'",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses a membership whose word does not exist",
    () => {
      execute(topicInsert("db-topic-words"))
      execute(packInsert("db-pack-words", "db-topic-words"))

      expectRefused(
        "INSERT INTO pack_words (pack_id, word_id, position) VALUES ('db-pack-words', 'db-word-missing', 1);",
        "SELECT COUNT(*) AS present FROM pack_words WHERE pack_id = 'db-pack-words'",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses a position below one",
    () => {
      execute(topicInsert("db-topic-position"))
      execute(packInsert("db-pack-position", "db-topic-position"))
      execute(wordInsert("db-word-position"))

      expectRefused(
        "INSERT INTO pack_words (pack_id, word_id, position) VALUES ('db-pack-position', 'db-word-position', 0);",
        "SELECT COUNT(*) AS present FROM pack_words WHERE pack_id = 'db-pack-position' AND position = 0",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses the same word twice in one pack",
    () => {
      execute(topicInsert("db-topic-dupe"))
      execute(packInsert("db-pack-dupe", "db-topic-dupe"))
      execute(wordInsert("db-word-dupe"))
      execute(
        "INSERT INTO pack_words (pack_id, word_id, position) VALUES ('db-pack-dupe', 'db-word-dupe', 1);",
      )

      expectRefused(
        "INSERT INTO pack_words (pack_id, word_id, position) VALUES ('db-pack-dupe', 'db-word-dupe', 2);",
        "SELECT COUNT(*) AS present FROM pack_words WHERE pack_id = 'db-pack-dupe' AND position = 2",
      )
    },
    TIMEOUT,
  )

  it(
    "refuses two words at the same position in one pack",
    () => {
      execute(topicInsert("db-topic-slot"))
      execute(packInsert("db-pack-slot", "db-topic-slot"))
      execute(wordInsert("db-word-slot-a"))
      execute(wordInsert("db-word-slot-b"))
      execute(
        "INSERT INTO pack_words (pack_id, word_id, position) VALUES ('db-pack-slot', 'db-word-slot-a', 1);",
      )

      expectRefused(
        "INSERT INTO pack_words (pack_id, word_id, position) VALUES ('db-pack-slot', 'db-word-slot-b', 1);",
        "SELECT COUNT(*) AS present FROM pack_words WHERE pack_id = 'db-pack-slot' AND word_id = 'db-word-slot-b'",
      )
    },
    TIMEOUT,
  )
})
