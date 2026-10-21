import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { Pack, Word } from "../domain/types"

interface AllowlistEntry {
  text: string
  level: number
  variants?: string[]
  phrase?: boolean
}

interface Allowlist {
  words: AllowlistEntry[]
}

interface ArtworkEntry {
  file: string
  status: "approved" | "placeholder"
}

function loadJson<T>(path: string): T {
  return JSON.parse(
    readFileSync(new URL(path, import.meta.url), "utf8"),
  ) as T
}

const allowlist = loadJson<Allowlist>("./cambridge-allowlist.json")
const packs = loadJson<Pack[]>("./packs.json")
const words = loadJson<Word[]>("./words.json")
const artwork = loadJson<Record<string, ArtworkEntry>>("./art/manifest.json")

const CRAFT_TOPIC = "craft-and-build"
const craftPacks = packs.filter((pack) => pack.topicId === CRAFT_TOPIC)
const craftWords = words.filter((word) =>
  word.topicIds.includes(CRAFT_TOPIC),
)
const wordsById = new Map(words.map((word) => [word.id, word]))

/**
 * Feature 17's authoring contract that `validate:content` cannot check: the
 * content validator knows nothing about the Cambridge allowlist, so nothing
 * else stops a word from being authored at the wrong band or invented
 * altogether. These assertions also protect the concrete→abstract shape of
 * each pack and the 80/20 core/thematic mix.
 *
 * The pilot authors one topic. The remaining topics still carry placeholder
 * slots in `dev`, so only the craft packs are asserted to resolve.
 */
describe("feature 17 — Craft & Build pilot", () => {
  it("authors three packs of twenty distinct, resolved words", () => {
    expect(craftPacks).toHaveLength(3)

    const ids = craftPacks.flatMap((pack) => pack.wordIds)

    expect(ids).toHaveLength(60)
    expect(new Set(ids).size).toBe(60)
    expect(craftWords).toHaveLength(60)

    for (const pack of craftPacks) {
      expect(pack.wordIds, pack.id).toHaveLength(20)
      expect(new Set(pack.wordIds).size, pack.id).toBe(20)

      for (const wordId of pack.wordIds) {
        expect(wordsById.has(wordId), `${pack.id} → ${wordId}`).toBe(true)
      }
    }
  })

  it("draws every craft word from the Cambridge allowlist at its band", () => {
    for (const word of craftWords) {
      const entries = allowlist.words.filter(
        (entry) =>
          entry.level === word.level &&
          (entry.text.toLowerCase() === word.text.toLowerCase() ||
            entry.variants?.includes(word.text.toLowerCase()) === true),
      )

      expect(
        entries.length,
        `${word.id} "${word.text}" (level ${word.level})`,
      ).toBeGreaterThan(0)

      expect(
        entries.some((entry) => entry.phrase === true),
        `${word.id} "${word.text}" must be a single word`,
      ).toBe(false)
    }
  })

  it("keeps the 80/20 core-to-thematic mix", () => {
    for (const word of craftWords) {
      const isCore = word.tags.includes("core")
      const isThematic = word.tags.includes("thematic")

      expect(isCore !== isThematic, `${word.id} tags: ${word.tags.join(",")}`).toBe(
        true,
      )
    }

    const thematic = craftWords.filter((word) =>
      word.tags.includes("thematic"),
    ).length

    expect(thematic).toBeGreaterThanOrEqual(9)
    expect(thematic).toBeLessThanOrEqual(15)
  })

  it("ends every pack on an abstract word", () => {
    for (const pack of craftPacks) {
      const finalThird = pack.wordIds
        .slice(Math.floor((pack.wordIds.length * 2) / 3))
        .map((wordId) => wordsById.get(wordId))

      expect(
        finalThird.some((word) => word?.tags.includes("abstract")),
        pack.id,
      ).toBe(true)
    }
  })

  it("leaves no orphan word record and no stale artwork entry", () => {
    const referenced = new Set(packs.flatMap((pack) => pack.wordIds))

    for (const word of words) {
      expect(referenced.has(word.id), `${word.id} is not in any pack`).toBe(true)
      expect(word.topicIds, word.id).toContain(CRAFT_TOPIC)

      const entry = artwork[word.id]

      expect(entry, `${word.id} has no artwork entry`).toBeDefined()
      expect(entry.file, word.id).toBe(`art/${word.id}.webp`)
    }

    expect(new Set(Object.keys(artwork))).toEqual(
      new Set(words.map((word) => word.id)),
    )
  })
})
