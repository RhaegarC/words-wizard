import { describe, expect, it } from "vitest"

import {
  ContentUnavailableError,
  contentEtag,
  ifNoneMatchMatches,
  toContentBundle,
  type AvatarRow,
  type AvatarStageRow,
  type ContentRows,
  type MetaRow,
  type PackRow,
  type PackWordRow,
  type TopicRow,
  type WordRow,
} from "./content"

const META: MetaRow = {
  schema_version: 1,
  dataset: "dev",
  content_version: "0.3.0",
}

function topic(
  id: string,
  sortOrder: number,
  archivedAt: number | null = null,
): TopicRow {
  return {
    id,
    title: id,
    title_zh: id,
    icon: "🔤",
    description: `${id} description`,
    description_zh: `${id} 描述`,
    sort_order: sortOrder,
    archived_at: archivedAt,
  }
}

function pack(
  id: string,
  topicId: string,
  sortOrder: number,
  archivedAt: number | null = null,
): PackRow {
  return {
    id,
    topic_id: topicId,
    title: id,
    title_zh: id,
    sort_order: sortOrder,
    archived_at: archivedAt,
  }
}

function word(
  id: string,
  overrides: Partial<WordRow> = {},
): WordRow {
  return {
    id,
    text: id,
    phonetic: `/${id}/`,
    part_of_speech: "noun",
    meaning_en: `meaning of ${id}`,
    meaning_zh: `${id} 的意思`,
    definition_en: `definition of ${id}`,
    definition_zh: `${id} 的解释`,
    examples: JSON.stringify([
      { en: `I see a ${id}.`, zh: `我看见一个${id}。` },
    ]),
    image: null,
    emoji: null,
    level: 1,
    tags: "[]",
    archived_at: null,
    ...overrides,
  }
}

function membership(packId: string, wordId: string, position: number): PackWordRow {
  return { pack_id: packId, word_id: wordId, position }
}

const AVATARS: AvatarRow[] = [
  {
    id: "luma",
    name: "Luma",
    name_zh: "露玛",
    color: "#7059dc",
    pale: "#eeeafd",
    sort_order: 2,
  },
  {
    id: "alex",
    name: "Alex",
    name_zh: "亚历克斯",
    color: "#000000",
    pale: "#ffffff",
    sort_order: 1,
  },
]

const STAGES: AvatarStageRow[] = [
  { avatar_id: "luma", stage: "egg", file: "luma-egg.webp" },
  { avatar_id: "luma", stage: "hatchling", file: "luma-hatchling.webp" },
  { avatar_id: "luma", stage: "juvenile", file: "luma-juvenile.webp" },
  { avatar_id: "luma", stage: "adult", file: "luma-adult.webp" },
  { avatar_id: "luma", stage: "legendary", file: "luma-legendary.webp" },
]

function rows(overrides: Partial<ContentRows> = {}): ContentRows {
  return {
    meta: META,
    // Served out of order and with an archived row.
    topics: [topic("t2", 2), topic("t3", 3, 1), topic("t1", 1)],
    packs: [
      pack("p2", "t1", 2),
      pack("p1", "t1", 1),
      pack("p3", "t2", 1),
      pack("p-archived", "t1", 3, 1),
      pack("p-under-archived-topic", "t3", 1),
    ],
    words: [
      word("w4"),
      word("w1", {
        image: "https://images.example.test/w1.webp",
        emoji: "🅰️",
        level: 2,
        tags: JSON.stringify(["abstract"]),
        examples: JSON.stringify([
          { en: "One example.", zh: "一个例子。" },
          { en: "Another example.", zh: "另一个例子。" },
        ]),
      }),
      word("w3"),
      word("w2"),
      word("w-archived", { archived_at: 1 }),
      word("w-unserved"),
    ],
    packWords: [
      // Deliberately out of position order.
      membership("p1", "w2", 2),
      membership("p1", "w1", 1),
      membership("p2", "w3", 1),
      membership("p3", "w3", 1),
      membership("p3", "w4", 2),
      membership("p-archived", "w1", 1),
      membership("p-under-archived-topic", "w2", 1),
      membership("p1", "w-archived", 3),
    ],
    avatars: AVATARS,
    avatarStages: STAGES,
    ...overrides,
  }
}

describe("toContentBundle", () => {
  it("maps the meta row", () => {
    expect(toContentBundle(rows()).meta).toEqual({
      schemaVersion: 1,
      dataset: "dev",
      contentVersion: "0.3.0",
    })
  })

  it("coerces an unexpected dataset to dev rather than serving unknown states", () => {
    const bundle = toContentBundle(
      rows({ meta: { ...META, dataset: "staging" } }),
    )

    expect(bundle.meta.dataset).toBe("dev")
  })

  it("throws when the meta row is missing", () => {
    expect(() => toContentBundle(rows({ meta: null }))).toThrow(
      ContentUnavailableError,
    )
  })

  it("serves active topics sorted by sort_order", () => {
    const bundle = toContentBundle(rows())

    expect(bundle.topics.map((item) => item.id)).toEqual(["t1", "t2"])
  })

  it("omits archived packs and packs under an archived topic", () => {
    const bundle = toContentBundle(rows())

    expect(bundle.packs.map((item) => item.id)).toEqual(["p1", "p2", "p3"])
  })

  it("orders a pack's words by position, not by id or insertion", () => {
    const bundle = toContentBundle(rows())
    const p1 = bundle.packs.find((item) => item.id === "p1")

    expect(p1?.wordIds).toEqual(["w1", "w2"])
  })

  it("derives a word's topics from its active pack memberships", () => {
    const bundle = toContentBundle(rows())
    const byId = new Map(bundle.words.map((item) => [item.id, item]))

    expect(byId.get("w1")?.topicIds).toEqual(["t1"])
    // Topic sort order first, then pack order — even when p3 is read first.
    expect(byId.get("w3")?.topicIds).toEqual(["t1", "t2"])
    expect(byId.get("w4")?.topicIds).toEqual(["t2"])
  })

  it("omits archived words and words with no active membership", () => {
    const bundle = toContentBundle(rows())

    expect(bundle.words.map((item) => item.id)).toEqual(["w1", "w2", "w3", "w4"])
  })

  it("maps every word column, parsing examples and tags as JSON", () => {
    const bundle = toContentBundle(rows())
    const w1 = bundle.words.find((item) => item.id === "w1")

    expect(w1).toEqual({
      id: "w1",
      text: "w1",
      phonetic: "/w1/",
      partOfSpeech: "noun",
      meaningEn: "meaning of w1",
      meaningZh: "w1 的意思",
      definitionEn: "definition of w1",
      definitionZh: "w1 的解释",
      examples: [
        { en: "One example.", zh: "一个例子。" },
        { en: "Another example.", zh: "另一个例子。" },
      ],
      image: "https://images.example.test/w1.webp",
      emoji: "🅰️",
      level: 2,
      tags: ["abstract"],
      topicIds: ["t1"],
    })
  })

  it("keeps a null image and omits an absent emoji", () => {
    const bundle = toContentBundle(rows())
    const w2 = bundle.words.find((item) => item.id === "w2")

    expect(w2?.image).toBeNull()
    expect(w2).not.toHaveProperty("emoji")
  })

  it("throws when a served word's examples are not a JSON array", () => {
    expect(() =>
      toContentBundle(
        rows({
          words: [word("w1", { examples: "not json" })],
        }),
      ),
    ).toThrow(ContentUnavailableError)
  })

  it("throws when tags are not a JSON array", () => {
    expect(() =>
      toContentBundle(
        rows({
          words: [word("w1", { tags: "{}" })],
        }),
      ),
    ).toThrow(ContentUnavailableError)
  })

  it("serves avatars in sort order with the stages the client knows", () => {
    const bundle = toContentBundle(rows())

    expect(bundle.avatars.map((item) => item.id)).toEqual(["alex", "luma"])
    expect(bundle.avatars[1]?.stages).toEqual({
      egg: "luma-egg.webp",
      hatchling: "luma-hatchling.webp",
      juvenile: "luma-juvenile.webp",
      adult: "luma-adult.webp",
      legendary: "luma-legendary.webp",
    })
  })
})

describe("contentEtag", () => {
  it("quotes the content version as a strong tag", () => {
    expect(contentEtag("0.3.0")).toBe('"0.3.0"')
  })
})

describe("ifNoneMatchMatches", () => {
  const etag = contentEtag("0.3.0")

  it("matches an absent header never", () => {
    expect(ifNoneMatchMatches(undefined, etag)).toBe(false)
  })

  it("matches the exact tag", () => {
    expect(ifNoneMatchMatches('"0.3.0"', etag)).toBe(true)
  })

  it("matches one tag in a comma-separated list", () => {
    expect(ifNoneMatchMatches('"0.2.0", "0.3.0"', etag)).toBe(true)
  })

  it("matches a wildcard", () => {
    expect(ifNoneMatchMatches("*", etag)).toBe(true)
  })

  it("does not match a stale tag", () => {
    expect(ifNoneMatchMatches('"0.2.0"', etag)).toBe(false)
  })

  it("does not match a weak tag", () => {
    expect(ifNoneMatchMatches('W/"0.3.0"', etag)).toBe(false)
  })
})
