import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

/**
 * D1 schema for the Worker. Feature 22 owns the content tables; feature 23
 * adds the user tables. Migrations are generated into `worker/drizzle/` with
 * `drizzle-kit generate` and applied by `wrangler d1 migrations apply`.
 *
 * Ids are immutable slugs and are never reused. Removal is `archived_at`, so
 * an in-flight session commit that names a row stays valid.
 */

/** The one row that tells the API which dataset and version is live. */
export const contentMeta = sqliteTable(
  "content_meta",
  {
    id: integer("id").primaryKey(),
    schemaVersion: integer("schema_version").notNull(),
    dataset: text("dataset", { enum: ["dev", "final"] }).notNull(),
    contentVersion: text("content_version").notNull(),
  },
  (table) => [
    check("content_meta_id", sql`${table.id} = 1`),
    check("content_meta_dataset", sql`${table.dataset} IN ('dev', 'final')`),
  ],
)

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  titleZh: text("title_zh").notNull(),
  icon: text("icon").notNull(),
  description: text("description").notNull(),
  descriptionZh: text("description_zh").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  archivedAt: integer("archived_at"),
})

export const packs = sqliteTable(
  "packs",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id),
    title: text("title").notNull(),
    titleZh: text("title_zh").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (table) => [index("packs_topic").on(table.topicId)],
)

export const words = sqliteTable(
  "words",
  {
    id: text("id").primaryKey(),
    text: text("text").notNull(),
    phonetic: text("phonetic").notNull(),
    partOfSpeech: text("part_of_speech").notNull(),
    meaningEn: text("meaning_en").notNull(),
    meaningZh: text("meaning_zh").notNull(),
    definitionEn: text("definition_en").notNull(),
    definitionZh: text("definition_zh").notNull(),
    /** `[{ en, zh }]`, at least one. */
    examples: text("examples").notNull(),
    /** R2 URL once artwork exists; null until then. */
    image: text("image"),
    /** Transitional tile fallback while `image` is null. */
    emoji: text("emoji"),
    level: integer("level").notNull(),
    /** JSON string array; `["abstract"]` marks an abstract/emotional word. */
    tags: text("tags").notNull().default("[]"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (table) => [
    check("words_level", sql`${table.level} IN (1, 2, 3)`),
    check("words_examples_json", sql`json_valid(${table.examples})`),
    check("words_tags_json", sql`json_valid(${table.tags})`),
    uniqueIndex("words_text_nocase").on(table.text),
  ],
)

export const packWords = sqliteTable(
  "pack_words",
  {
    packId: text("pack_id")
      .notNull()
      .references(() => packs.id),
    wordId: text("word_id")
      .notNull()
      .references(() => words.id),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.packId, table.position] }),
    uniqueIndex("pack_words_pack_word").on(table.packId, table.wordId),
    check("pack_words_position", sql`${table.position} >= 1`),
    index("pack_words_word").on(table.wordId),
  ],
)

export const avatars = sqliteTable("avatars", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameZh: text("name_zh").notNull(),
  color: text("color").notNull(),
  pale: text("pale").notNull(),
  sortOrder: integer("sort_order").notNull(),
})

export const avatarStages = sqliteTable(
  "avatar_stages",
  {
    avatarId: text("avatar_id")
      .notNull()
      .references(() => avatars.id),
    stage: text("stage").notNull(),
    file: text("file").notNull(),
  },
  (table) => [primaryKey({ columns: [table.avatarId, table.stage] })],
)
