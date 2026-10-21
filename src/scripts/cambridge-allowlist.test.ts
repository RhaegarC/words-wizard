import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

interface AllowlistEntry {
  text: string
  level: number
  partsOfSpeech: string[]
  variants?: string[]
  note?: string
  phrase?: boolean
}

interface Allowlist {
  source: { file: string; title: string; version: string }
  levels: Record<string, string>
  words: AllowlistEntry[]
}

const allowlist = JSON.parse(
  readFileSync(
    new URL("../content/cambridge-allowlist.json", import.meta.url),
    "utf8",
  ),
) as Allowlist

function entriesFor(text: string): AllowlistEntry[] {
  const wanted = text.toLowerCase()

  return allowlist.words.filter((entry) => entry.text.toLowerCase() === wanted)
}

const TIMES = new Set(["a.m.", "p.m."])

/**
 * The allowlist is generated from the Cambridge 2025 PDF by
 * `scripts/extract-wordlist.mjs`. These assertions protect the properties a
 * bad extraction would silently break: lost bands, given names surviving as
 * vocabulary, duplicated records, and lost variant information. Reverting the
 * JSON or the size filters in the extractor turns them red.
 */
describe("content/cambridge-allowlist.json", () => {
  it("records the source document and names all three bands", () => {
    expect(allowlist.source.file).toMatch(
      /739104-starters-movers-flyers-word-list-2025\.pdf$/,
    )
    expect(allowlist.source.version).toBe("2025")

    expect(allowlist.levels).toEqual({
      "1": "Pre A1 Starters",
      "2": "A1 Movers",
      "3": "A2 Flyers",
    })
  })

  it("keeps a usable pool of words in every band", () => {
    for (const level of [1, 2, 3]) {
      const count = allowlist.words.filter((entry) => entry.level === level).length

      expect(count, `level ${level}`).toBeGreaterThan(300)
    }
  })

  it("assigns each word to its Cambridge band", () => {
    expect(entriesFor("bag").map((entry) => entry.level)).toEqual([1])
    expect(entriesFor("address").map((entry) => entry.level)).toEqual([2])
    expect(entriesFor("astronaut").map((entry) => entry.level)).toEqual([3])
    expect(entriesFor("x-ray").map((entry) => entry.level)).toEqual([3])
  })

  it("does not promote the board's given names to vocabulary", () => {
    for (const name of ["Alex", "Alice", "Dan", "Katy", "Tom", "Zoe", "William"]) {
      expect(entriesFor(name), name).toEqual([])
    }
  })

  it("records a part of speech for every headword", () => {
    for (const entry of allowlist.words) {
      if (TIMES.has(entry.text)) {
        expect(entry.partsOfSpeech, entry.text).toEqual([])
        continue
      }

      expect(entry.partsOfSpeech.length, entry.text).toBeGreaterThan(0)
    }
  })

  it("keeps one record per band, headword, note, and part of speech", () => {
    const keys = allowlist.words.map(
      (entry) =>
        `${entry.level}|${entry.text.toLowerCase()}|${entry.note ?? ""}|${entry.partsOfSpeech.join("+")}`,
    )

    expect(new Set(keys).size).toBe(keys.length)
  })

  it("expands only the unambiguous parenthetical forms", () => {
    expect(entriesFor("blond(e)")[0]?.variants).toEqual(["blond", "blonde"])
    expect(entriesFor("stair(s)")[0]?.variants).toEqual(["stair", "stairs"])
    expect(entriesFor("mouse/mice")[0]?.variants).toBeUndefined()
  })

  it("marks multi-word entries as phrases and leaves single words alone", () => {
    expect(entriesFor("ice cream")[0]?.phrase).toBe(true)
    expect(entriesFor("bag")[0]?.phrase).toBeUndefined()
  })

  it("writes no blank or padded headwords", () => {
    for (const entry of allowlist.words) {
      expect(entry.text, JSON.stringify(entry)).toBe(entry.text.trim())
      expect(entry.text.length, JSON.stringify(entry)).toBeGreaterThan(0)
    }
  })
})
