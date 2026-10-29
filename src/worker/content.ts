import type { ContentBundle, ContentMeta } from "../shared/content/types"
import { STAGE_IDS } from "../shared/types"
import type { Avatar } from "../shared/content/types"
import type { Pack, Topic, Word, WordExample } from "../shared/types"

import type { D1Database } from "./db/d1"

/**
 * The content read path: rows in, one `ContentBundle` out.
 *
 * `toContentBundle` is pure so the mapping is unit-testable without a
 * database. `readContent` is only the SQL, and both the route and the
 * database-tier integrity test assemble through the same function.
 *
 * Derivation rules (feature 22):
 * - archived topics, packs, and words are omitted;
 * - an archived topic hides its packs and every membership under them;
 * - a pack's `wordIds` follow `pack_words.position`;
 * - a word's `topicIds` are the active topics that contain it, ordered by
 *   topic `sort_order` then pack `sort_order`;
 * - a word with no active membership is not served.
 */

export interface MetaRow {
  schema_version: number
  dataset: string
  content_version: string
}

export interface TopicRow {
  id: string
  title: string
  title_zh: string
  icon: string
  description: string
  description_zh: string
  sort_order: number
  archived_at: number | null
}

export interface PackRow {
  id: string
  topic_id: string
  title: string
  title_zh: string
  sort_order: number
  archived_at: number | null
}

export interface WordRow {
  id: string
  text: string
  phonetic: string
  part_of_speech: string
  meaning_en: string
  meaning_zh: string
  definition_en: string
  definition_zh: string
  examples: string
  image: string | null
  emoji: string | null
  level: number
  tags: string
  archived_at: number | null
}

export interface PackWordRow {
  pack_id: string
  word_id: string
  position: number
}

export interface AvatarRow {
  id: string
  name: string
  name_zh: string
  color: string
  pale: string
  sort_order: number
}

export interface AvatarStageRow {
  avatar_id: string
  stage: string
  file: string
}

export interface ContentRows {
  meta: MetaRow | null
  topics: readonly TopicRow[]
  packs: readonly PackRow[]
  words: readonly WordRow[]
  packWords: readonly PackWordRow[]
  avatars: readonly AvatarRow[]
  avatarStages: readonly AvatarStageRow[]
}

/** D1 has no row for "not migrated yet"; a missing meta row is a failure. */
export class ContentUnavailableError extends Error {
  constructor(message = "content_meta has no row; apply the migrations.") {
    super(message)
    this.name = new.target.name
  }
}

export function toContentBundle(rows: ContentRows): ContentBundle {
  if (rows.meta === null) throw new ContentUnavailableError()

  const meta: ContentMeta = {
    schemaVersion: rows.meta.schema_version,
    dataset: rows.meta.dataset === "final" ? "final" : "dev",
    contentVersion: rows.meta.content_version,
  }

  const topics: Topic[] = rows.topics
    .filter((row) => row.archived_at === null)
    .sort(bySortOrder)
    .map((row) => ({
      id: row.id,
      title: row.title,
      titleZh: row.title_zh,
      icon: row.icon,
      description: row.description,
      descriptionZh: row.description_zh,
      sortOrder: row.sort_order,
    }))

  const topicOrder = new Map(topics.map((topic, index) => [topic.id, index]))
  const packs: Pack[] = rows.packs
    .filter(
      (row) => row.archived_at === null && topicOrder.has(row.topic_id),
    )
    // Topic order first, then `sort_order` within the topic, so the flat array
    // is deterministic and matches what the picker renders.
    .sort(
      (left, right) =>
        (topicOrder.get(left.topic_id) ?? 0) -
          (topicOrder.get(right.topic_id) ?? 0) ||
        bySortOrder(left, right),
    )
    .map((row) => ({
      id: row.id,
      title: row.title,
      titleZh: row.title_zh,
      topicId: row.topic_id,
      wordIds: [],
      order: row.sort_order,
    }))

  const packById = new Map(packs.map((pack) => [pack.id, pack]))
  const activeWords = rows.words.filter((row) => row.archived_at === null)
  const wordRowsById = new Map(activeWords.map((row) => [row.id, row]))

  const membershipsByWord = new Map<string, PackWordRow[]>()
  const membershipsByPack = new Map<string, PackWordRow[]>()

  for (const membership of rows.packWords) {
    if (
      !packById.has(membership.pack_id) ||
      !wordRowsById.has(membership.word_id)
    ) {
      continue
    }

    const byWord = membershipsByWord.get(membership.word_id) ?? []
    byWord.push(membership)
    membershipsByWord.set(membership.word_id, byWord)

    const byPack = membershipsByPack.get(membership.pack_id) ?? []
    byPack.push(membership)
    membershipsByPack.set(membership.pack_id, byPack)
  }

  // `wordIds` follows `pack_words.position` — the order the pack introduces.
  for (const pack of packs) {
    pack.wordIds = [...(membershipsByPack.get(pack.id) ?? [])]
      .sort((left, right) => left.position - right.position)
      .map((membership) => membership.word_id)
  }

  const topicIdsByWord = new Map<string, string[]>()

  for (const [wordId, memberships] of membershipsByWord) {
    // A word's topic order: topic sort first, then the pack that holds it.
    const ordered = [...memberships].sort((left, right) => {
      const leftPack = packById.get(left.pack_id)!
      const rightPack = packById.get(right.pack_id)!
      const leftTopic = topicOrder.get(leftPack.topicId) ?? Number.MAX_SAFE_INTEGER
      const rightTopic = topicOrder.get(rightPack.topicId) ?? Number.MAX_SAFE_INTEGER

      return (
        leftTopic - rightTopic ||
        leftPack.order - rightPack.order ||
        leftPack.id.localeCompare(rightPack.id)
      )
    })

    const topicIds: string[] = []

    for (const membership of ordered) {
      const topicId = packById.get(membership.pack_id)!.topicId
      if (!topicIds.includes(topicId)) topicIds.push(topicId)
    }

    topicIdsByWord.set(wordId, topicIds)
  }

  const words: Word[] = activeWords
    .filter((row) => topicIdsByWord.has(row.id))
    .map((row) => toWord(row, topicIdsByWord.get(row.id) ?? []))
    .sort((left, right) => left.id.localeCompare(right.id))

  return {
    meta,
    topics,
    packs,
    words,
    avatars: toAvatars(rows.avatars, rows.avatarStages),
  }
}

function toWord(row: WordRow, topicIds: readonly string[]): Word {
  return {
    id: row.id,
    text: row.text,
    phonetic: row.phonetic,
    partOfSpeech: row.part_of_speech,
    meaningEn: row.meaning_en,
    meaningZh: row.meaning_zh,
    definitionEn: row.definition_en,
    definitionZh: row.definition_zh,
    examples: parseExamples(row.examples, row.id),
    image: row.image,
    ...(row.emoji === null ? {} : { emoji: row.emoji }),
    level: row.level as Word["level"],
    tags: parseTags(row.tags, row.id),
    topicIds: [...topicIds],
  }
}

function parseExamples(value: string, wordId: string): WordExample[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) throw new Error("not an array")

    return parsed.map((entry) => {
      const example = entry as { en?: unknown; zh?: unknown }
      return {
        en: typeof example.en === "string" ? example.en : "",
        zh: typeof example.zh === "string" ? example.zh : "",
      }
    })
  } catch {
    throw new ContentUnavailableError(
      `Word "${wordId}" has examples that are not a JSON array.`,
    )
  }
}

function parseTags(value: string, wordId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) throw new Error("not an array")

    return parsed.filter((tag): tag is string => typeof tag === "string")
  } catch {
    throw new ContentUnavailableError(
      `Word "${wordId}" has tags that are not a JSON array.`,
    )
  }
}

function toAvatars(
  avatars: readonly AvatarRow[],
  stages: readonly AvatarStageRow[],
): Avatar[] {
  const filesByAvatar = new Map<string, Map<string, string>>()

  for (const row of stages) {
    const files = filesByAvatar.get(row.avatar_id) ?? new Map<string, string>()
    files.set(row.stage, row.file)
    filesByAvatar.set(row.avatar_id, files)
  }

  return [...avatars]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((row) => {
      const files = filesByAvatar.get(row.id) ?? new Map<string, string>()
      const mapped: Record<string, string> = {}

      for (const stage of STAGE_IDS) {
        const file = files.get(stage)
        if (file !== undefined) mapped[stage] = file
      }

      return {
        id: row.id,
        name: row.name,
        nameZh: row.name_zh,
        color: row.color,
        pale: row.pale,
        stages: mapped as Avatar["stages"],
      }
    })
}

function bySortOrder(
  left: { sort_order: number; id: string },
  right: { sort_order: number; id: string },
): number {
  return left.sort_order - right.sort_order || left.id.localeCompare(right.id)
}

/** A strong ETag: the version, quoted, exactly as HTTP wants it. */
export function contentEtag(contentVersion: string): string {
  return `"${contentVersion}"`
}

export function ifNoneMatchMatches(header: string | undefined, etag: string): boolean {
  if (header === undefined) return false

  return header
    .split(",")
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === etag || candidate === "*")
}

const SELECT = {
  meta: "SELECT schema_version, dataset, content_version FROM content_meta WHERE id = 1",
  topics:
    "SELECT id, title, title_zh, icon, description, description_zh, sort_order, archived_at FROM topics",
  packs:
    "SELECT id, topic_id, title, title_zh, sort_order, archived_at FROM packs",
  words:
    "SELECT id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, archived_at FROM words",
  packWords: "SELECT pack_id, word_id, position FROM pack_words",
  avatars: "SELECT id, name, name_zh, color, pale, sort_order FROM avatars",
  avatarStages: "SELECT avatar_id, stage, file FROM avatar_stages",
} as const

/** Read every row the bundle needs. Archive filtering happens in the mapper. */
export async function readContent(db: D1Database): Promise<ContentBundle> {
  const [meta, topics, packs, words, packWords, avatars, avatarStages] =
    await Promise.all([
      db.prepare(SELECT.meta).first<MetaRow>(),
      db.prepare(SELECT.topics).all<TopicRow>(),
      db.prepare(SELECT.packs).all<PackRow>(),
      db.prepare(SELECT.words).all<WordRow>(),
      db.prepare(SELECT.packWords).all<PackWordRow>(),
      db.prepare(SELECT.avatars).all<AvatarRow>(),
      db.prepare(SELECT.avatarStages).all<AvatarStageRow>(),
    ])

  return toContentBundle({
    meta,
    topics: topics.results,
    packs: packs.results,
    words: words.results,
    packWords: packWords.results,
    avatars: avatars.results,
    avatarStages: avatarStages.results,
  })
}

/** `/health` needs the live version only, not the whole bundle. */
export async function readContentVersion(db: D1Database): Promise<string> {
  const row = await db
    .prepare("SELECT content_version FROM content_meta WHERE id = 1")
    .first<{ content_version: string }>()

  if (row === null) throw new ContentUnavailableError()
  return row.content_version
}
