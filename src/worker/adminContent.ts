import type {
  AdminMembership,
  AdminPack,
  AdminSnapshot,
  AdminTopic,
  AdminWord,
} from "../shared/admin"

import { ContentUnavailableError, readContentRows, toWord } from "./content"
import type { ContentRows, PackWordRow } from "./content"
import type { D1Database } from "./db/d1"

/**
 * The admin read model (feature 28).
 *
 * The public bundle deliberately drops archived rows and words in no pack; the
 * portal needs exactly those rows to archive, restore, and place words. Both
 * mappings start from the same `ContentRows`, so the two views cannot drift
 * apart on field names or JSON decoding.
 */

export function toAdminSnapshot(rows: ContentRows): AdminSnapshot {
  if (rows.meta === null) throw new ContentUnavailableError()

  const topics: AdminTopic[] = [...rows.topics]
    .sort(bySortOrder)
    .map((row) => ({
      id: row.id,
      title: row.title,
      titleZh: row.title_zh,
      icon: row.icon,
      description: row.description,
      descriptionZh: row.description_zh,
      sortOrder: row.sort_order,
      archivedAt: row.archived_at,
    }))

  const topicOrder = new Map(topics.map((topic, index) => [topic.id, index]))
  const packs: AdminPack[] = [...rows.packs]
    .sort(
      (left, right) =>
        (topicOrder.get(left.topic_id) ?? Number.MAX_SAFE_INTEGER) -
          (topicOrder.get(right.topic_id) ?? Number.MAX_SAFE_INTEGER) ||
        bySortOrder(left, right),
    )
    .map((row) => ({
      id: row.id,
      topicId: row.topic_id,
      title: row.title,
      titleZh: row.title_zh,
      sortOrder: row.sort_order,
      archivedAt: row.archived_at,
    }))

  const packById = new Map(packs.map((pack) => [pack.id, pack]))
  const packOrder = new Map(packs.map((pack, index) => [pack.id, index]))
  const wordIds = new Set(rows.words.map((word) => word.id))

  const membershipsByPack = new Map<string, PackWordRow[]>()
  const membershipsByWord = new Map<string, PackWordRow[]>()

  for (const membership of rows.packWords) {
    if (!packById.has(membership.pack_id) || !wordIds.has(membership.word_id)) {
      continue
    }

    const byPack = membershipsByPack.get(membership.pack_id) ?? []
    byPack.push(membership)
    membershipsByPack.set(membership.pack_id, byPack)

    const byWord = membershipsByWord.get(membership.word_id) ?? []
    byWord.push(membership)
    membershipsByWord.set(membership.word_id, byWord)
  }

  // Every pack gets an entry, empty included, so the portal can render a pack
  // without a lookup that may be absent.
  const memberships: AdminMembership[] = packs.map((pack) => ({
    packId: pack.id,
    wordIds: [...(membershipsByPack.get(pack.id) ?? [])]
      .sort((left, right) => left.position - right.position)
      .map((membership) => membership.word_id),
  }))

  const topicIdsByWord = new Map<string, string[]>()

  for (const [wordId, list] of membershipsByWord) {
    const ordered = [...list].sort(
      (left, right) =>
        (packOrder.get(left.pack_id) ?? Number.MAX_SAFE_INTEGER) -
        (packOrder.get(right.pack_id) ?? Number.MAX_SAFE_INTEGER),
    )
    const ids: string[] = []

    for (const membership of ordered) {
      const topicId = packById.get(membership.pack_id)!.topicId
      if (!ids.includes(topicId)) ids.push(topicId)
    }

    topicIdsByWord.set(wordId, ids)
  }

  const words: AdminWord[] = [...rows.words]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((row) => ({
      ...toWord(row, topicIdsByWord.get(row.id) ?? []),
      archivedAt: row.archived_at,
    }))

  return {
    contentVersion: rows.meta.content_version,
    dataset: rows.meta.dataset === "final" ? "final" : "dev",
    topics,
    packs,
    words,
    memberships,
  }
}

function bySortOrder(
  left: { sort_order: number; id: string },
  right: { sort_order: number; id: string },
): number {
  return left.sort_order - right.sort_order || left.id.localeCompare(right.id)
}

export async function readAdminSnapshot(db: D1Database): Promise<AdminSnapshot> {
  return toAdminSnapshot(await readContentRows(db))
}
