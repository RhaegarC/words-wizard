import type { Context, Hono } from "hono"

import type { AdminPack, AdminTopic } from "../shared/admin"
import {
  bumpContentVersion,
  checkProposal,
  packIdFor,
  parsePackCreate,
  parsePackOrder,
  parsePackPatch,
  parseTopicCreate,
  parseTopicOrder,
  parseTopicPatch,
  topicIdFor,
} from "../shared/adminWrite"
import type { ParsedWrite } from "../shared/adminWrite"
import type { ContentIssue } from "../shared/content/types"

import { readContentRows, readContentVersion, toContentBundle } from "./content"
import type { ContentRows, PackRow, TopicRow } from "./content"
import { requireDb } from "./config"
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
