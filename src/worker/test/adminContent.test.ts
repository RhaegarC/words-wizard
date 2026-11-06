import { describe, expect, it } from "vitest"

import { toAdminSnapshot } from "../adminContent"
import { ContentUnavailableError } from "../content"
import type { ContentRows, WordRow } from "../content"

/**
 * The admin read model is a pure mapping over the same rows the public bundle
 * reads. It keeps what the public path drops: archived rows, words in no pack,
 * and empty packs.
 */

function wordRow(
  id: string,
  overrides: Partial<WordRow> = {},
): WordRow {
  return {
    id,
    text: id,
    phonetic: `/${id}/`,
    part_of_speech: "noun",
    meaning_en: "meaning",
    meaning_zh: "意思",
    definition_en: "definition",
    definition_zh: "定义",
    examples: JSON.stringify([{ en: `I see ${id}.`, zh: `我看到 ${id}。` }]),
    image: null,
    emoji: null,
    level: 1,
    tags: "[]",
    archived_at: null,
    ...overrides,
  }
}

const ROWS: ContentRows = {
  meta: { schema_version: 1, dataset: "dev", content_version: "9.9.9" },
  topics: [
    {
      id: "topic-live",
      title: "Live",
      title_zh: "在线",
      icon: "LV",
      description: "d",
      description_zh: "d",
      sort_order: 1,
      archived_at: null,
    },
    {
      id: "topic-archived",
      title: "Archived",
      title_zh: "归档",
      icon: "AR",
      description: "d",
      description_zh: "d",
      sort_order: 2,
      archived_at: 111,
    },
  ],
  packs: [
    {
      id: "pack-live",
      topic_id: "topic-live",
      title: "Live pack",
      title_zh: "在线包",
      sort_order: 1,
      archived_at: null,
    },
    {
      id: "pack-archived",
      topic_id: "topic-live",
      title: "Archived pack",
      title_zh: "归档包",
      sort_order: 2,
      archived_at: 222,
    },
    {
      id: "pack-empty",
      topic_id: "topic-live",
      title: "Empty pack",
      title_zh: "空包",
      sort_order: 3,
      archived_at: null,
    },
    {
      id: "pack-under-archived",
      topic_id: "topic-archived",
      title: "Hidden by ancestor",
      title_zh: "被祖先隐藏",
      sort_order: 1,
      archived_at: null,
    },
  ],
  words: [
    wordRow("word-a"),
    wordRow("word-b", { archived_at: 333 }),
    wordRow("word-free", { image: "https://api.example.test/v1/images/free.png" }),
  ],
  packWords: [
    { pack_id: "pack-live", word_id: "word-b", position: 1 },
    { pack_id: "pack-live", word_id: "word-a", position: 2 },
    { pack_id: "pack-archived", word_id: "word-a", position: 1 },
    { pack_id: "pack-under-archived", word_id: "word-free", position: 1 },
  ],
  avatars: [],
  avatarStages: [],
}

describe("toAdminSnapshot", () => {
  it("keeps archived topics and packs, in their written order", () => {
    const snapshot = toAdminSnapshot(ROWS)

    expect(snapshot.topics.map((topic) => topic.id)).toEqual([
      "topic-live",
      "topic-archived",
    ])
    expect(snapshot.topics[1]?.archivedAt).toBe(111)
    expect(snapshot.packs.map((pack) => pack.id)).toEqual([
      "pack-live",
      "pack-archived",
      "pack-empty",
      "pack-under-archived",
    ])
    expect(snapshot.packs[1]?.archivedAt).toBe(222)
    // A pack under an archived topic keeps its own null archive stamp.
    expect(snapshot.packs[3]?.archivedAt).toBeNull()
  })

  it("keeps words in no pack and archived words", () => {
    const snapshot = toAdminSnapshot(ROWS)
    const ids = snapshot.words.map((word) => word.id)

    expect(ids).toEqual(["word-a", "word-b", "word-free"])
    expect(snapshot.words[1]?.archivedAt).toBe(333)
    expect(snapshot.words[2]?.image).toBe(
      "https://api.example.test/v1/images/free.png",
    )
    // `topicIds` is derived from every membership, archived ancestry included.
    expect(snapshot.words[2]?.topicIds).toEqual(["topic-archived"])
  })

  it("serves membership in position order, empty packs included", () => {
    const snapshot = toAdminSnapshot(ROWS)
    const byPack = new Map(
      snapshot.memberships.map((membership) => [
        membership.packId,
        membership.wordIds,
      ]),
    )

    expect(byPack.get("pack-live")).toEqual(["word-b", "word-a"])
    expect(byPack.get("pack-archived")).toEqual(["word-a"])
    expect(byPack.get("pack-empty")).toEqual([])
    expect(byPack.get("pack-under-archived")).toEqual(["word-free"])
  })

  it("carries the live version and dataset", () => {
    expect(toAdminSnapshot(ROWS)).toMatchObject({
      contentVersion: "9.9.9",
      dataset: "dev",
    })
  })

  it("fails loudly when the content_meta row is absent", () => {
    expect(() => toAdminSnapshot({ ...ROWS, meta: null })).toThrow(
      ContentUnavailableError,
    )
  })
})
