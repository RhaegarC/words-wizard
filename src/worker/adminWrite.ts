import type { Context, Hono } from "hono"

import type {
  AdminMembership,
  AdminPack,
  AdminTopic,
  AdminWord,
} from "../shared/admin"
import {
  bumpContentVersion,
  checkProposal,
  headwordTaken,
  packIdFor,
  parseMembership,
  parsePackCreate,
  parsePackOrder,
  parsePackPatch,
  parseTopicCreate,
  parseTopicOrder,
  parseTopicPatch,
  parseWordCreate,
  parseWordPatch,
  topicIdFor,
  wordIdFor,
} from "../shared/adminWrite"
import type { ParsedWrite } from "../shared/adminWrite"
import type { ContentIssue } from "../shared/content/types"

import {
  readContentRows,
  readContentVersion,
  toContentBundle,
  toWord,
} from "./content"
import type { ContentRows, PackRow, TopicRow, WordRow } from "./content"
import { detectImageType } from "./avatar"
import { requireDb, requireWordImages } from "./config"
import type { AppEnv } from "./context"
import type { D1Database, D1PreparedStatement } from "./db/d1"
import {
  ArchivedError,
  ConflictError,
  ContentNotFoundError,
  ContentValidationError,
  ValidationFailedError,
} from "./errors"
import { readBody } from "./requestBody"
import {
  MAX_WORD_IMAGE_BYTES,
  WORD_IMAGE_CACHE_CONTROL,
  keyFromImageUrl,
  wordImageKey,
  wordImageUrl,
} from "./wordImage"

/**
 * The admin write surface (feature 29).
 *
 * Every route runs behind the feature 28 chain, so the caller is already known
 * to be a teacher or admin before a handler is reached. The shared write
 * mechanics are applied in one order on every route:
 *
 * 1. the body is parsed against an allowlist of fields;
 * 2. the snapshot version, when sent, must still be current;
 * 3. the proposed content is validated in memory before anything is written;
 * 4. the row write and the version bump share one atomic D1 batch.
 *
 * A rejected or no-op change writes nothing and leaves the version alone.
 */

interface WriteResponse {
  readonly contentVersion: string
  readonly warnings: readonly ContentIssue[]
  readonly topic?: AdminTopic
  readonly pack?: AdminPack
  readonly word?: AdminWord
  readonly membership?: AdminMembership
}

function topicToAdmin(row: TopicRow): AdminTopic {
  return {
    id: row.id,
    title: row.title,
    titleZh: row.title_zh,
    icon: row.icon,
    description: row.description,
    descriptionZh: row.description_zh,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
  }
}

function packToAdmin(row: PackRow): AdminPack {
  return {
    id: row.id,
    topicId: row.topic_id,
    title: row.title,
    titleZh: row.title_zh,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
  }
}

/**
 * The topic ids a word appears in, in the admin snapshot's order: topic
 * `sort_order`, then the pack that holds it. Archived ancestry counts, since
 * the portal shows where a word is placed even while its pack is hidden.
 */
function topicIdsForWord(rows: ContentRows, wordId: string): string[] {
  const topicOrder = new Map(
    [...rows.topics].sort(bySortOrder).map((topic, index) => [topic.id, index]),
  )
  const packById = new Map(rows.packs.map((pack) => [pack.id, pack]))
  const packOrder = new Map(
    [...rows.packs]
      .sort(
        (left, right) =>
          (topicOrder.get(left.topic_id) ?? Number.MAX_SAFE_INTEGER) -
            (topicOrder.get(right.topic_id) ?? Number.MAX_SAFE_INTEGER) ||
          bySortOrder(left, right),
      )
      .map((pack, index) => [pack.id, index]),
  )

  const memberships = rows.packWords
    .filter((membership) => membership.word_id === wordId)
    .sort(
      (left, right) =>
        (packOrder.get(left.pack_id) ?? Number.MAX_SAFE_INTEGER) -
        (packOrder.get(right.pack_id) ?? Number.MAX_SAFE_INTEGER),
    )

  const topicIds: string[] = []

  for (const membership of memberships) {
    const topicId = packById.get(membership.pack_id)?.topic_id
    if (topicId !== undefined && !topicIds.includes(topicId)) {
      topicIds.push(topicId)
    }
  }

  return topicIds
}

function wordToAdmin(rows: ContentRows, row: WordRow): AdminWord {
  return {
    ...toWord(row, topicIdsForWord(rows, row.id)),
    archivedAt: row.archived_at,
  }
}

function nextMembershipPosition(rows: ContentRows, packId: string): number {
  return (
    Math.max(
      0,
      ...rows.packWords
        .filter((membership) => membership.pack_id === packId)
        .map((membership) => membership.position),
    ) + 1
  )
}

function membershipIds(rows: ContentRows, packId: string): string[] {
  return rows.packWords
    .filter((membership) => membership.pack_id === packId)
    .sort((left, right) => left.position - right.position)
    .map((membership) => membership.word_id)
}

/** Arrays in the same order, not merely the same members. */
function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  )
}

function findWord(rows: ContentRows, id: string): WordRow {
  const row = rows.words.find((word) => word.id === id)
  if (row === undefined) throw new ContentNotFoundError("The word does not exist.")

  return row
}

function replaceMembership(
  rows: ContentRows,
  packId: string,
  ids: readonly string[],
): ContentRows {
  return {
    ...rows,
    packWords: [
      ...rows.packWords.filter((membership) => membership.pack_id !== packId),
      ...ids.map((wordId, index) => ({
        pack_id: packId,
        word_id: wordId,
        position: index + 1,
      })),
    ],
  }
}

/** D1 caps bound parameters at 100; three per row leaves 33 rows a statement. */
const MEMBERSHIP_ROWS_PER_STATEMENT = 33

function membershipStatements(
  db: D1Database,
  packId: string,
  ids: readonly string[],
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = []

  for (let start = 0; start < ids.length; start += MEMBERSHIP_ROWS_PER_STATEMENT) {
    const chunk = ids.slice(start, start + MEMBERSHIP_ROWS_PER_STATEMENT)
    const placeholders = chunk.map(() => "(?, ?, ?)").join(", ")
    const parameters = chunk.flatMap((wordId, index) => [
      packId,
      wordId,
      start + index + 1,
    ])

    statements.push(
      db
        .prepare(
          `INSERT INTO pack_words (pack_id, word_id, position) VALUES ${placeholders}`,
        )
        .bind(...parameters),
    )
  }

  return statements
}

/** Room for multipart boundaries and part headers around the 2 MiB file. */
const MULTIPART_OVERHEAD = 64 * 1024

function bySortOrder(
  left: { sort_order: number; id: string },
  right: { sort_order: number; id: string },
): number {
  return left.sort_order - right.sort_order || left.id.localeCompare(right.id)
}

function nextTopicOrder(rows: ContentRows): number {
  return Math.max(0, ...rows.topics.map((row) => row.sort_order)) + 1
}

function nextPackOrder(rows: ContentRows, topicId: string): number {
  return (
    Math.max(
      0,
      ...rows.packs
        .filter((row) => row.topic_id === topicId)
        .map((row) => row.sort_order),
    ) + 1
  )
}

function requireParsed<T>(parsed: ParsedWrite<T>): T {
  if (!parsed.ok) {
    throw new ValidationFailedError(
      `The request body is not valid: ${[...new Set(parsed.issues)].join(", ")}.`,
    )
  }

  return parsed.value
}

/**
 * The version the client edited against. The header is optional so a script
 * may write without one; the portal always sends it.
 */
async function currentVersion(
  c: Context<AppEnv>,
  db: D1Database,
): Promise<string> {
  const version = await readContentVersion(db)
  const header = c.req.header("if-match")?.trim()

  if (header !== undefined && header !== "" && header !== "*") {
    const claimed =
      header.startsWith('"') && header.endsWith('"')
        ? header.slice(1, -1)
        : header

    if (claimed !== version) throw new ConflictError()
  }

  return version
}

function versionStatement(
  db: D1Database,
  contentVersion: string,
): D1PreparedStatement {
  return db
    .prepare("UPDATE content_meta SET content_version = ? WHERE id = 1")
    .bind(contentVersion)
}

/** Validate a create or an edit; a structural finding rejects the write. */
function requireValidProposal(rows: ContentRows): readonly ContentIssue[] {
  const check = checkProposal(toContentBundle(rows))

  if (check.errors.length > 0) throw new ContentValidationError(check.errors)
  return check.warnings
}

/**
 * Archive, restore, and reorder cannot introduce a structural error, so they
 * report warnings without blocking: a teacher must be able to hide content
 * that an earlier save left imperfect.
 */
function warningsOnly(rows: ContentRows): readonly ContentIssue[] {
  return checkProposal(toContentBundle(rows)).warnings
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false

  const seen = new Set(left)
  return right.every((id) => seen.has(id))
}

function findTopic(rows: ContentRows, id: string): TopicRow {
  const row = rows.topics.find((topic) => topic.id === id)
  if (row === undefined) throw new ContentNotFoundError("The topic does not exist.")

  return row
}

function findPack(rows: ContentRows, id: string): PackRow {
  const row = rows.packs.find((pack) => pack.id === id)
  if (row === undefined) throw new ContentNotFoundError("The pack does not exist.")

  return row
}

export function registerAdminWriteRoutes(app: Hono<AppEnv>): void {
  app.post("/v1/admin/topics", async (c) => {
    const input = requireParsed(parseTopicCreate(await readBody(c)))
    const db = requireDb(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)
    const now = Date.now()

    const id = topicIdFor(
      input.title,
      new Set(rows.topics.map((row) => row.id)),
    )

    const row: TopicRow = {
      id,
      title: input.title,
      title_zh: input.titleZh,
      icon: input.icon,
      description: input.description,
      description_zh: input.descriptionZh,
      sort_order: nextTopicOrder(rows),
      archived_at: null,
    }

    const warnings = requireValidProposal({
      ...rows,
      topics: [...rows.topics, row],
    })
    const nextVersion = bumpContentVersion(version)

    await db.batch([
      db
        .prepare(
          "INSERT INTO topics (id, title, title_zh, icon, description, description_zh, sort_order, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
        )
        .bind(
          row.id,
          row.title,
          row.title_zh,
          row.icon,
          row.description,
          row.description_zh,
          row.sort_order,
          now,
          now,
        ),
      versionStatement(db, nextVersion),
    ])

    const body: WriteResponse = {
      contentVersion: nextVersion,
      warnings,
      topic: topicToAdmin(row),
    }

    return c.json(body, 201)
  })

  app.patch("/v1/admin/topics/:id", async (c) => {
    const input = requireParsed(parseTopicPatch(await readBody(c)))
    const db = requireDb(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)
    const existing = findTopic(rows, c.req.param("id"))
    const now = Date.now()

    if (existing.archived_at !== null) throw new ArchivedError()

    const row: TopicRow = {
      ...existing,
      title: input.title ?? existing.title,
      title_zh: input.titleZh ?? existing.title_zh,
      icon: input.icon ?? existing.icon,
      description: input.description ?? existing.description,
      description_zh: input.descriptionZh ?? existing.description_zh,
    }

    const warnings = requireValidProposal({
      ...rows,
      topics: rows.topics.map((topic) => (topic.id === row.id ? row : topic)),
    })
    const nextVersion = bumpContentVersion(version)

    await db.batch([
      db
        .prepare(
          "UPDATE topics SET title = ?, title_zh = ?, icon = ?, description = ?, description_zh = ?, updated_at = ? WHERE id = ?",
        )
        .bind(
          row.title,
          row.title_zh,
          row.icon,
          row.description,
          row.description_zh,
          now,
          row.id,
        ),
      versionStatement(db, nextVersion),
    ])

    const body: WriteResponse = {
      contentVersion: nextVersion,
      warnings,
      topic: topicToAdmin(row),
    }

    return c.json(body)
  })

  registerArchiveRoutes(app, "topics", {
    rowsOf: (rows) => rows.topics,
    replace: (rows, row) => ({
      ...rows,
      topics: rows.topics.map((topic) => (topic.id === row.id ? row : topic)),
    }),
    respond: (contentVersion, warnings, topic) => ({
      contentVersion,
      warnings,
      topic: topicToAdmin(topic),
    }),
  })

  registerArchiveRoutes(app, "packs", {
    rowsOf: (rows) => rows.packs,
    replace: (rows, row) => ({
      ...rows,
      packs: rows.packs.map((pack) => (pack.id === row.id ? row : pack)),
    }),
    respond: (contentVersion, warnings, pack) => ({
      contentVersion,
      warnings,
      pack: packToAdmin(pack),
    }),
  })

  app.put("/v1/admin/topics/order", async (c) => {
    const input = requireParsed(parseTopicOrder(await readBody(c)))
    const db = requireDb(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)

    const live = rows.topics
      .filter((row) => row.archived_at === null)
      .sort(bySortOrder)
      .map((row) => row.id)

    if (!sameIds(live, input.ids)) {
      throw new ValidationFailedError(
        "The order must list every live topic exactly once.",
      )
    }

    const warnings = warningsOnly(rows)

    if (live.every((id, index) => id === input.ids[index])) {
      return c.json({ contentVersion: version, warnings } satisfies WriteResponse)
    }

    const nextVersion = bumpContentVersion(version)
    const now = Date.now()

    await db.batch([
      ...input.ids.map((id, index) =>
        db
          .prepare("UPDATE topics SET sort_order = ?, updated_at = ? WHERE id = ?")
          .bind(index + 1, now, id),
      ),
      versionStatement(db, nextVersion),
    ])

    return c.json({ contentVersion: nextVersion, warnings } satisfies WriteResponse)
  })

  app.put("/v1/admin/packs/order", async (c) => {
    const input = requireParsed(parsePackOrder(await readBody(c)))
    const db = requireDb(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)
    const topic = findTopic(rows, input.topicId)

    if (topic.archived_at !== null) {
      throw new ArchivedError("The topic is archived. Restore it first.")
    }

    const live = rows.packs
      .filter((row) => row.topic_id === topic.id && row.archived_at === null)
      .sort(bySortOrder)
      .map((row) => row.id)

    if (!sameIds(live, input.ids)) {
      throw new ValidationFailedError(
        "The order must list every live pack in the topic exactly once.",
      )
    }

    const warnings = warningsOnly(rows)

    if (live.every((id, index) => id === input.ids[index])) {
      return c.json({ contentVersion: version, warnings } satisfies WriteResponse)
    }

    const nextVersion = bumpContentVersion(version)
    const now = Date.now()

    await db.batch([
      ...input.ids.map((id, index) =>
        db
          .prepare("UPDATE packs SET sort_order = ?, updated_at = ? WHERE id = ?")
          .bind(index + 1, now, id),
      ),
      versionStatement(db, nextVersion),
    ])

    return c.json({ contentVersion: nextVersion, warnings } satisfies WriteResponse)
  })

  app.post("/v1/admin/packs", async (c) => {
    const input = requireParsed(parsePackCreate(await readBody(c)))
    const db = requireDb(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)
    const topic = findTopic(rows, input.topicId)
    const now = Date.now()

    if (topic.archived_at !== null) {
      throw new ArchivedError("The topic is archived. Restore it first.")
    }

    const id = packIdFor(
      topic.id,
      new Set(rows.packs.map((row) => row.id)),
    )

    const row: PackRow = {
      id,
      topic_id: topic.id,
      title: input.title,
      title_zh: input.titleZh,
      sort_order: nextPackOrder(rows, topic.id),
      archived_at: null,
    }

    const warnings = requireValidProposal({
      ...rows,
      packs: [...rows.packs, row],
    })
    const nextVersion = bumpContentVersion(version)

    await db.batch([
      db
        .prepare(
          "INSERT INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)",
        )
        .bind(
          row.id,
          row.topic_id,
          row.title,
          row.title_zh,
          row.sort_order,
          now,
          now,
        ),
      versionStatement(db, nextVersion),
    ])

    const body: WriteResponse = {
      contentVersion: nextVersion,
      warnings,
      pack: packToAdmin(row),
    }

    return c.json(body, 201)
  })

  app.patch("/v1/admin/packs/:id", async (c) => {
    const input = requireParsed(parsePackPatch(await readBody(c)))
    const db = requireDb(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)
    const existing = findPack(rows, c.req.param("id"))
    const now = Date.now()

    if (existing.archived_at !== null) throw new ArchivedError()

    const row: PackRow = {
      ...existing,
      title: input.title ?? existing.title,
      title_zh: input.titleZh ?? existing.title_zh,
    }

    const warnings = requireValidProposal({
      ...rows,
      packs: rows.packs.map((pack) => (pack.id === row.id ? row : pack)),
    })
    const nextVersion = bumpContentVersion(version)

    await db.batch([
      db
        .prepare(
          "UPDATE packs SET title = ?, title_zh = ?, updated_at = ? WHERE id = ?",
        )
        .bind(row.title, row.title_zh, now, row.id),
      versionStatement(db, nextVersion),
    ])

    const body: WriteResponse = {
      contentVersion: nextVersion,
      warnings,
      pack: packToAdmin(row),
    }

    return c.json(body)
  })

  app.post("/v1/admin/words", async (c) => {
    const input = requireParsed(parseWordCreate(await readBody(c)))
    const db = requireDb(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)

    const duplicate = headwordTaken(rows.words, input.text)
    if (duplicate !== null) {
      throw new ConflictError(
        `A word with the headword "${input.text}" already exists as "${duplicate}".`,
      )
    }

    let pack: PackRow | undefined

    if (input.packId !== undefined) {
      pack = findPack(rows, input.packId)

      if (pack.archived_at !== null) {
        throw new ArchivedError("The pack is archived. Restore it first.")
      }

      const topic = rows.topics.find((row) => row.id === pack!.topic_id)
      if (topic === undefined) {
        throw new ContentNotFoundError("The pack's topic does not exist.")
      }
      if (topic.archived_at !== null) {
        throw new ArchivedError("The pack's topic is archived. Restore it first.")
      }
    }

    const now = Date.now()
    const row: WordRow = {
      id: wordIdFor(input.text, new Set(rows.words.map((word) => word.id))),
      text: input.text,
      phonetic: input.phonetic,
      part_of_speech: input.partOfSpeech,
      meaning_en: input.meaningEn,
      meaning_zh: input.meaningZh,
      definition_en: input.definitionEn,
      definition_zh: input.definitionZh,
      examples: JSON.stringify(input.examples),
      image: null,
      emoji: input.emoji,
      level: input.level,
      tags: JSON.stringify(input.tags),
      archived_at: null,
    }

    const position =
      pack === undefined ? undefined : nextMembershipPosition(rows, pack.id)

    const proposed: ContentRows =
      pack === undefined || position === undefined
        ? { ...rows, words: [...rows.words, row] }
        : {
            ...rows,
            words: [...rows.words, row],
            packWords: [
              ...rows.packWords,
              { pack_id: pack.id, word_id: row.id, position },
            ],
          }

    const warnings = requireValidProposal(proposed)
    const nextVersion = bumpContentVersion(version)

    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          "INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL)",
        )
        .bind(
          row.id,
          row.text,
          row.phonetic,
          row.part_of_speech,
          row.meaning_en,
          row.meaning_zh,
          row.definition_en,
          row.definition_zh,
          row.examples,
          row.emoji,
          row.level,
          row.tags,
          now,
          now,
        ),
    ]

    if (pack !== undefined && position !== undefined) {
      statements.push(
        db
          .prepare(
            "INSERT INTO pack_words (pack_id, word_id, position) VALUES (?, ?, ?)",
          )
          .bind(pack.id, row.id, position),
      )
    }

    statements.push(versionStatement(db, nextVersion))
    await db.batch(statements)

    const body: WriteResponse = {
      contentVersion: nextVersion,
      warnings,
      word: wordToAdmin(proposed, row),
      ...(pack === undefined
        ? {}
        : { membership: { packId: pack.id, wordIds: membershipIds(proposed, pack.id) } }),
    }

    return c.json(body, 201)
  })

  app.patch("/v1/admin/words/:id", async (c) => {
    const input = requireParsed(parseWordPatch(await readBody(c)))
    const db = requireDb(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)
    const existing = findWord(rows, c.req.param("id"))
    const now = Date.now()

    if (existing.archived_at !== null) {
      throw new ArchivedError("This word is archived and cannot be edited.")
    }

    if (input.text !== undefined) {
      const duplicate = headwordTaken(rows.words, input.text, existing.id)
      if (duplicate !== null) {
        throw new ConflictError(
          `A word with the headword "${input.text}" already exists as "${duplicate}".`,
        )
      }
    }

    const row: WordRow = {
      ...existing,
      text: input.text ?? existing.text,
      phonetic: input.phonetic ?? existing.phonetic,
      part_of_speech: input.partOfSpeech ?? existing.part_of_speech,
      meaning_en: input.meaningEn ?? existing.meaning_en,
      meaning_zh: input.meaningZh ?? existing.meaning_zh,
      definition_en: input.definitionEn ?? existing.definition_en,
      definition_zh: input.definitionZh ?? existing.definition_zh,
      examples:
        input.examples === undefined
          ? existing.examples
          : JSON.stringify(input.examples),
      emoji: input.emoji === undefined ? existing.emoji : input.emoji,
      level: input.level ?? existing.level,
      tags: input.tags === undefined ? existing.tags : JSON.stringify(input.tags),
    }

    const warnings = requireValidProposal({
      ...rows,
      words: rows.words.map((word) => (word.id === row.id ? row : word)),
    })
    const nextVersion = bumpContentVersion(version)

    await db.batch([
      db
        .prepare(
          "UPDATE words SET text = ?, phonetic = ?, part_of_speech = ?, meaning_en = ?, meaning_zh = ?, definition_en = ?, definition_zh = ?, examples = ?, emoji = ?, level = ?, tags = ?, updated_at = ? WHERE id = ?",
        )
        .bind(
          row.text,
          row.phonetic,
          row.part_of_speech,
          row.meaning_en,
          row.meaning_zh,
          row.definition_en,
          row.definition_zh,
          row.examples,
          row.emoji,
          row.level,
          row.tags,
          now,
          row.id,
        ),
      versionStatement(db, nextVersion),
    ])

    const body: WriteResponse = {
      contentVersion: nextVersion,
      warnings,
      word: wordToAdmin(rows, row),
    }

    return c.json(body)
  })

  /**
   * Upload a word picture (feature 31). The image is stored under a fresh
   * immutable key and the row is pointed at it; the previous object is deleted
   * best-effort once the row update has succeeded. A failed row update deletes
   * the object it just wrote, so nothing is left that no row references.
   */
  app.post("/v1/admin/words/:id/image", async (c) => {
    const db = requireDb(c.env)
    const bucket = requireWordImages(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)
    const existing = findWord(rows, c.req.param("id"))

    if (existing.archived_at !== null) {
      throw new ArchivedError("This word is archived and cannot be edited.")
    }

    // A multipart wrapper is larger than the file; refuse an obviously large
    // body before parsing it, then the exact file size after.
    const declared = c.req.header("content-length")
    if (declared !== undefined) {
      const size = Number(declared)
      if (
        Number.isFinite(size) &&
        size > MAX_WORD_IMAGE_BYTES + MULTIPART_OVERHEAD
      ) {
        throw new ValidationFailedError("The image exceeds 2 MB.")
      }
    }

    let form: Record<string, string | File>
    try {
      form = await c.req.parseBody()
    } catch {
      throw new ValidationFailedError(
        "The request must be multipart/form-data.",
      )
    }

    const file = form["file"]
    if (!(file instanceof File)) {
      throw new ValidationFailedError("Attach exactly one `file` field.")
    }
    if (file.size > MAX_WORD_IMAGE_BYTES) {
      throw new ValidationFailedError("The image exceeds 2 MB.")
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const detected = detectImageType(bytes)
    if (detected === null) {
      throw new ValidationFailedError(
        "Only JPEG, PNG, and WebP images are accepted.",
      )
    }

    const key = wordImageKey(existing.id, crypto.randomUUID(), detected.ext)
    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType: detected.mime,
        cacheControl: WORD_IMAGE_CACHE_CONTROL,
      },
    })

    const now = Date.now()
    const image = wordImageUrl(new URL(c.req.url).origin, key)
    const row: WordRow = { ...existing, image }
    const proposed: ContentRows = {
      ...rows,
      words: rows.words.map((word) => (word.id === row.id ? row : word)),
    }
    const warnings = warningsOnly(proposed)
    const nextVersion = bumpContentVersion(version)

    try {
      await db.batch([
        db
          .prepare("UPDATE words SET image = ?, updated_at = ? WHERE id = ?")
          .bind(image, now, row.id),
        versionStatement(db, nextVersion),
      ])
    } catch (caught) {
      await bucket.delete(key).catch(() => undefined)
      throw caught
    }

    if (existing.image !== null) {
      const previous = keyFromImageUrl(existing.image)
      if (previous !== null) await bucket.delete(previous).catch(() => undefined)
    }

    return c.json({
      contentVersion: nextVersion,
      warnings,
      word: wordToAdmin(proposed, row),
    } satisfies WriteResponse)
  })

  app.delete("/v1/admin/words/:id/image", async (c) => {
    const db = requireDb(c.env)
    const bucket = requireWordImages(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)
    const existing = findWord(rows, c.req.param("id"))

    if (existing.archived_at !== null) {
      throw new ArchivedError("This word is archived and cannot be edited.")
    }

    // The child app already falls back to the emoji; nothing to write.
    if (existing.image === null) {
      return c.json({
        contentVersion: version,
        warnings: warningsOnly(rows),
        word: wordToAdmin(rows, existing),
      } satisfies WriteResponse)
    }

    const row: WordRow = { ...existing, image: null }
    const proposed: ContentRows = {
      ...rows,
      words: rows.words.map((word) => (word.id === row.id ? row : word)),
    }
    const warnings = warningsOnly(proposed)
    const nextVersion = bumpContentVersion(version)

    await db.batch([
      db
        .prepare("UPDATE words SET image = NULL, updated_at = ? WHERE id = ?")
        .bind(Date.now(), row.id),
      versionStatement(db, nextVersion),
    ])

    const key = keyFromImageUrl(existing.image)
    if (key !== null) await bucket.delete(key).catch(() => undefined)

    return c.json({
      contentVersion: nextVersion,
      warnings,
      word: wordToAdmin(proposed, row),
    } satisfies WriteResponse)
  })

  app.put("/v1/admin/packs/:id/membership", async (c) => {
    const input = requireParsed(parseMembership(await readBody(c)))
    const db = requireDb(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)
    const pack = findPack(rows, c.req.param("id"))
    const topic = rows.topics.find((row) => row.id === pack.topic_id)

    if (topic === undefined) {
      throw new ContentNotFoundError("The pack's topic does not exist.")
    }
    if (pack.archived_at !== null) {
      throw new ArchivedError("The pack is archived. Restore it first.")
    }
    if (topic.archived_at !== null) {
      throw new ArchivedError("The pack's topic is archived. Restore it first.")
    }

    const wordsById = new Map(rows.words.map((word) => [word.id, word]))

    for (const wordId of input.ids) {
      const word = wordsById.get(wordId)

      if (word === undefined) {
        throw new ValidationFailedError(
          `The pack cannot contain unknown word "${wordId}".`,
        )
      }

      if (word.archived_at !== null) {
        throw new ValidationFailedError(
          `The pack cannot contain archived word "${wordId}".`,
        )
      }
    }

    const proposed = replaceMembership(rows, pack.id, input.ids)
    const warnings = warningsOnly(proposed)
    const current = membershipIds(rows, pack.id)

    if (sameOrder(current, input.ids)) {
      return c.json({
        contentVersion: version,
        warnings,
        membership: { packId: pack.id, wordIds: current },
      } satisfies WriteResponse)
    }

    const nextVersion = bumpContentVersion(version)

    await db.batch([
      db.prepare("DELETE FROM pack_words WHERE pack_id = ?").bind(pack.id),
      ...membershipStatements(db, pack.id, input.ids),
      db
        .prepare("UPDATE packs SET updated_at = ? WHERE id = ?")
        .bind(Date.now(), pack.id),
      versionStatement(db, nextVersion),
    ])

    return c.json({
      contentVersion: nextVersion,
      warnings,
      membership: { packId: pack.id, wordIds: [...input.ids] },
    } satisfies WriteResponse)
  })
}

interface ArchiveTarget<T extends TopicRow | PackRow> {
  rowsOf(rows: ContentRows): readonly T[]
  replace(rows: ContentRows, row: T): ContentRows
  respond(
    contentVersion: string,
    warnings: readonly ContentIssue[],
    row: T,
  ): WriteResponse
}

/**
 * `topics` and `packs` share the archive/restore shape: one nullable column,
 * a no-op when the row is already in the requested state, and a bump only
 * when something changed.
 */
function registerArchiveRoutes<T extends TopicRow | PackRow>(
  app: Hono<AppEnv>,
  table: "topics" | "packs",
  target: ArchiveTarget<T>,
): void {
  app.post(`/v1/admin/${table}/:id/archive`, async (c) => {
    const db = requireDb(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)
    const id = c.req.param("id")
    const row = findRow(target.rowsOf(rows), id, table)

    if (row.archived_at !== null) {
      return c.json(target.respond(version, warningsOnly(rows), row))
    }

    const now = Date.now()
    const archived: T = { ...row, archived_at: now }
    const warnings = warningsOnly(target.replace(rows, archived))
    const nextVersion = bumpContentVersion(version)

    await db.batch([
      db
        .prepare(
          `UPDATE ${table} SET archived_at = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(now, now, id),
      versionStatement(db, nextVersion),
    ])

    return c.json(target.respond(nextVersion, warnings, archived))
  })

  app.post(`/v1/admin/${table}/:id/restore`, async (c) => {
    const db = requireDb(c.env)
    const version = await currentVersion(c, db)
    const rows = await readContentRows(db)
    const id = c.req.param("id")
    const row = findRow(target.rowsOf(rows), id, table)

    if (row.archived_at === null) {
      return c.json(target.respond(version, warningsOnly(rows), row))
    }

    const now = Date.now()
    const restored: T = { ...row, archived_at: null }
    const warnings = warningsOnly(target.replace(rows, restored))
    const nextVersion = bumpContentVersion(version)

    await db.batch([
      db
        .prepare(
          `UPDATE ${table} SET archived_at = NULL, updated_at = ? WHERE id = ?`,
        )
        .bind(now, id),
      versionStatement(db, nextVersion),
    ])

    return c.json(target.respond(nextVersion, warnings, restored))
  })
}

function findRow<T extends TopicRow | PackRow>(
  rows: readonly T[],
  id: string,
  table: "topics" | "packs",
): T {
  const row = rows.find((candidate) => candidate.id === id)
  if (row === undefined) {
    throw new ContentNotFoundError(`The ${table.slice(0, -1)} does not exist.`)
  }

  return row
}
