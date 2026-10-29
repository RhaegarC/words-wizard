import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { getTableConfig } from "drizzle-orm/sqlite-core"
import { describe, expect, it } from "vitest"

import {
  avatarStages,
  avatars,
  contentMeta,
  packWords,
  packs,
  topics,
  words,
} from "./schema"

/**
 * Model tier: the ORM's model and the SQL committed for it, compared without
 * opening a connection. It catches a schema edited in one place and not the
 * other in under a second; the database tier proves the engine accepts it.
 */

const drizzleDir = fileURLToPath(new URL("../drizzle", import.meta.url))

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name)
}

describe("content model", () => {
  it("declares the seven content tables", () => {
    expect(
      [
        contentMeta,
        topics,
        packs,
        words,
        packWords,
        avatars,
        avatarStages,
      ].map((table) => getTableConfig(table).name),
    ).toEqual([
      "content_meta",
      "topics",
      "packs",
      "words",
      "pack_words",
      "avatars",
      "avatar_stages",
    ])
  })

  it("keeps the word record and its nullable image", () => {
    expect(columnNames(words)).toEqual([
      "id",
      "text",
      "phonetic",
      "part_of_speech",
      "meaning_en",
      "meaning_zh",
      "definition_en",
      "definition_zh",
      "examples",
      "image",
      "emoji",
      "level",
      "tags",
      "created_at",
      "updated_at",
      "archived_at",
    ])

    expect(words.image.notNull).toBe(false)
    expect(words.archivedAt.notNull).toBe(false)
    expect(words.level.getSQLType()).toBe("integer")
  })

  it("does not model removed tables or unlock columns", () => {
    const tables = [
      contentMeta,
      topics,
      packs,
      words,
      packWords,
      avatars,
      avatarStages,
    ]

    for (const table of tables) {
      const config = getTableConfig(table)
      const columns = config.columns.map((column) => column.name)

      expect(columns).not.toContain("unlock_rule")
      expect(columns).not.toContain("word_topics")
      expect(columns).not.toContain("pack_ids")
      expect(config.name).not.toMatch(/word_topics|word_examples|artwork/)
    }
  })

  it("constrains content_meta to one row in a known dataset", () => {
    expect(
      getTableConfig(contentMeta).checks.map((check) => check.name).sort(),
    ).toEqual(["content_meta_dataset", "content_meta_id"])
  })

  it("constrains a word's level and its JSON columns", () => {
    expect(
      getTableConfig(words).checks.map((check) => check.name).sort(),
    ).toEqual(["words_examples_json", "words_level", "words_tags_json"])
  })

  it("keys pack_words by position and by word", () => {
    const config = getTableConfig(packWords)

    expect(config.primaryKeys).toHaveLength(1)
    expect(
      config.primaryKeys[0]?.columns.map((column) => column.name),
    ).toEqual(["pack_id", "position"])

    const unique = config.indexes.find(
      (index) => index.config.name === "pack_words_pack_word",
    )
    expect(unique?.config.unique).toBe(true)
    expect(
      unique?.config.columns.map((column) =>
        "name" in column ? column.name : String(column),
      ),
    ).toEqual(["pack_id", "word_id"])

    expect(config.checks.map((check) => check.name)).toEqual([
      "pack_words_position",
    ])
  })

  it("points every foreign key at a content table", () => {
    const targets = (table: Parameters<typeof getTableConfig>[0]) =>
      getTableConfig(table).foreignKeys.map((key) =>
        getTableConfig(key.reference().foreignTable).name,
      )

    expect(targets(packs)).toEqual(["topics"])
    expect(targets(packWords).sort()).toEqual(["packs", "words"])
    expect(targets(avatarStages)).toEqual(["avatars"])
  })
})

describe("committed migrations", () => {
  const schema = readFileSync(
    join(drizzleDir, "0000_content_schema.sql"),
    "utf8",
  )

  it("declares the headword index case-insensitively", () => {
    expect(schema).toMatch(
      /CREATE UNIQUE INDEX `words_text_nocase` ON `words` \(`text` COLLATE NOCASE\)/,
    )
  })

  it("creates no table or column the model does not declare", () => {
    expect(schema).not.toMatch(/word_topics|word_examples|artwork/)
    expect(schema).not.toMatch(/unlock_rule|pack_ids/)
  })

  it("writes the checks the model declares into the committed SQL", () => {
    expect(schema).toContain(
      'CONSTRAINT "content_meta_id" CHECK("content_meta"."id" = 1)',
    )
    expect(schema).toContain(
      `CONSTRAINT "content_meta_dataset" CHECK("content_meta"."dataset" IN ('dev', 'final'))`,
    )
    expect(schema).toContain(
      `CONSTRAINT "words_level" CHECK("words"."level" IN (1, 2, 3))`,
    )
    expect(schema.match(/CONSTRAINT "words_.*_json" CHECK\(json_valid/g)).toHaveLength(
      2,
    )
    expect(schema).toContain(
      `CONSTRAINT "pack_words_position" CHECK("pack_words"."position" >= 1)`,
    )
  })

  it("has a migration file for every journal entry", () => {
    const journal = JSON.parse(
      readFileSync(join(drizzleDir, "meta", "_journal.json"), "utf8"),
    ) as { entries: Array<{ tag: string }> }
    const files = new Set(readdirSync(drizzleDir))

    for (const entry of journal.entries) {
      expect(files.has(`${entry.tag}.sql`)).toBe(true)
    }
  })
})
