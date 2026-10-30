import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
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

/* ------------------------------------------------------------------------- *
 * User data (feature 23)
 *
 * Every user-owned row cascades from `users`; content rows never cascade,
 * because content is archived rather than deleted. Identity is the Entra
 * `oid`, and no route accepts a user id in its body or path.
 * ------------------------------------------------------------------------- */

export const users = sqliteTable("users", {
  oid: text("oid").primaryKey(),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
})

export const profiles = sqliteTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.oid, { onDelete: "cascade" }),
    characterName: text("character_name").notNull(),
    avatar: text("avatar").notNull(),
    currentTopicId: text("current_topic_id").references(() => topics.id),
    xp: integer("xp").notNull(),
    createdAt: integer("created_at").notNull(),
    lastPracticeAt: integer("last_practice_at").notNull(),
    lastWakeAt: integer("last_wake_at"),
    frozenDays: integer("frozen_days").notNull(),
    careTokens: integer("care_tokens").notNull(),
    sessionsSinceLastToken: integer("sessions_since_last_token").notNull(),
    completedSessions: integer("completed_sessions").notNull(),
    streakCount: integer("streak_count").notNull(),
    bestStreak: integer("best_streak").notNull(),
    lastStreakDate: text("last_streak_date"),
    lastMonthlyReviewAt: integer("last_monthly_review_at"),
    locale: text("locale", { enum: ["en", "zh"] }).notNull(),
  },
  (table) => [
    check("profiles_locale", sql`${table.locale} IN ('en', 'zh')`),
  ],
)

export const progress = sqliteTable(
  "progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.oid, { onDelete: "cascade" }),
    wordId: text("word_id")
      .notNull()
      .references(() => words.id),
    status: text("status", {
      enum: ["new", "learning", "mastered"],
    }).notNull(),
    strength: real("strength").notNull(),
    nextReviewAt: integer("next_review_at").notNull(),
    correctCount: integer("correct_count").notNull(),
    wrongCount: integer("wrong_count").notNull(),
    firstSeenAt: integer("first_seen_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    masteryXpAwarded: integer("mastery_xp_awarded", {
      mode: "boolean",
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.wordId] }),
    check(
      "progress_status",
      sql`${table.status} IN ('new', 'learning', 'mastered')`,
    ),
    check(
      "progress_strength",
      sql`${table.strength} >= 0 AND ${table.strength} <= 1`,
    ),
  ],
)

export const packIntroductions = sqliteTable(
  "pack_introductions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.oid, { onDelete: "cascade" }),
    packId: text("pack_id")
      .notNull()
      .references(() => packs.id),
    wordId: text("word_id")
      .notNull()
      .references(() => words.id),
    introducedAt: integer("introduced_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.packId, table.wordId] }),
  ],
)

export const metrics = sqliteTable(
  "metrics",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.oid, { onDelete: "cascade" }),
    name: text("name").notNull(),
    value: real("value").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.name] })],
)

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.oid, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["daily", "monthly"] }).notNull(),
    localDate: text("local_date").notNull(),
    contentVersion: text("content_version").notNull(),
    xpEarned: integer("xp_earned").notNull(),
    finishedAt: integer("finished_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    check("sessions_kind", sql`${table.kind} IN ('daily', 'monthly')`),
  ],
)

export const sessionMetrics = sqliteTable(
  "session_metrics",
  {
    userId: text("user_id").notNull(),
    sessionId: text("session_id").notNull(),
    name: text("name").notNull(),
    delta: real("delta").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.sessionId, table.name] }),
    foreignKey({
      columns: [table.userId, table.sessionId],
      foreignColumns: [sessions.userId, sessions.id],
    }).onDelete("cascade"),
  ],
)

export const metricEvents = sqliteTable(
  "metric_events",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.oid, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    name: text("name").notNull(),
    delta: real("delta").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.eventId] })],
)
