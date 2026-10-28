#!/usr/bin/env node
/**
 * Extract the three Cambridge A–Z word lists from the 2025 wordlist PDF into
 * `content/cambridge-allowlist.json`.
 *
 * This is a one-off authoring tool for feature 17. It is not part of the
 * build, the test suite, or `validate:content`: the generated JSON is the
 * durable artefact, and the PDF is never parsed at runtime or in CI.
 *
 * `pdf-parse` is a dev dependency purely for this script; it is never
 * bundled or imported by application code.
 *
 * Usage:
 *   node scripts/extract-wordlist.mjs [pdf] [output]
 */

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

// The package entrypoint runs its own test PDF when `module.parent` is unset,
// which is always the case under ESM. Import the implementation directly.
import pdfParse from "pdf-parse/lib/pdf-parse.js"

const defaultPdf = fileURLToPath(
  new URL(
    "../../../docs/sample_data/739104-starters-movers-flyers-word-list-2025.pdf",
    import.meta.url,
  ),
)
const defaultOutput = fileURLToPath(
  new URL("../content/cambridge-allowlist.json", import.meta.url),
)

const pdfPath = process.argv[2] ?? defaultPdf
const outputPath = process.argv[3] ?? defaultOutput

const LEVELS = new Map([
  [1, "Pre A1 Starters"],
  [2, "A1 Movers"],
  [3, "A2 Flyers"],
])

const HEADERS = [
  { level: 1, pattern: /Pre A1 Starters\s+A[–-]Z wordlist/ },
  { level: 2, pattern: /A1 Movers\s+A[–-]Z wordlist/ },
  { level: 3, pattern: /A2 Flyers\s+A[–-]Z wordlist/ },
]

/** The abbreviations used in the PDF's grammatical key. */
const POS = new Map([
  ["adj", "adjective"],
  ["adv", "adverb"],
  ["conj", "conjunction"],
  ["det", "determiner"],
  ["dis", "discourse marker"],
  ["excl", "exclamation"],
  ["int", "interrogative"],
  ["n", "noun"],
  ["poss", "possessive"],
  ["prep", "preposition"],
  ["pron", "pronoun"],
  ["title", "title"],
  ["v", "verb"],
])

const POS_TOKENS = new Set(POS.keys())
const SECTION_ENDINGS = new Set(["Letters & numbers", "Numbers"])

async function readPages(path) {
  const pages = []

  await pdfParse(readFileSync(path), {
    pagerender: async (pageData) => {
      const content = await pageData.getTextContent()
      let lastY = null
      let text = ""

      for (const item of content.items) {
        const y = item.transform[5]

        if (lastY !== null && Math.abs(y - lastY) > 2) {
          text += "\n"
        }

        text += item.str
        lastY = y
      }

      pages.push(text)
      return ""
    },
  })

  return pages
}

function detectLevel(page) {
  const head = page.slice(0, 400)

  for (const { level, pattern } of HEADERS) {
    if (pattern.test(head)) {
      return level
    }
  }

  return null
}

/**
 * Split one line into entries. An entry is a headword followed by a
 * part-of-speech expression such as `n`, `adj + adv`, or `prep of place`.
 * Splitting this way also repairs lines where extraction merged two
 * entries, for example `zebra n zoo n`.
 */
function parseLine(line) {
  const tokens = line.split(/\s+/).filter(Boolean)
  const entries = []
  let textStart = 0
  let index = 0

  while (index < tokens.length) {
    if (!POS_TOKENS.has(tokens[index])) {
      index += 1
      continue
    }

    let end = index + 1

    while (end < tokens.length) {
      const token = tokens[end]

      if (POS_TOKENS.has(token) || token === "+") {
        end += 1
        continue
      }

      if (
        token === "of" &&
        (tokens[end + 1] === "place" || tokens[end + 1] === "time")
      ) {
        end += 2
        continue
      }

      // `prep of place + time`
      if (
        (token === "place" || token === "time") &&
        (tokens[end - 1] === "of" || tokens[end - 1] === "+")
      ) {
        end += 1
        continue
      }

      break
    }

    const text = tokens.slice(textStart, index).join(" ").trim()

    if (text !== "") {
      entries.push({
        text,
        posExpression: tokens.slice(index, end).join(" "),
      })
    }

    textStart = end
    index = end
  }

  const remainder = tokens.slice(textStart).join(" ").trim()

  return { entries, remainder }
}

function hasUnclosedParenthesis(text) {
  let depth = 0

  for (const character of text) {
    if (character === "(") {
      depth += 1
    } else if (character === ")") {
      depth -= 1
    }
  }

  return depth > 0
}

/** A line is complete when it yields entries and leaves nothing behind. */
function isComplete(line, parsed) {
  if (/^[ap]\.m\./.test(line)) {
    return true
  }

  return parsed.entries.length > 0 && parsed.remainder === ""
}

/**
 * Extraction wraps long entries onto the next line: `kilometre` followed by
 * `(US kilometer) n`, or a headword whose parenthetical runs over. A bare
 * part-of-speech line is the other shape. Only those shapes are rejoined — a
 * new entry is never appended to the previous one.
 */
function continues(line, next) {
  if (next === "" || /^[A-Z]$/.test(next)) {
    return false
  }

  if (SECTION_ENDINGS.has(next) || next === "Names") {
    return false
  }

  return (
    hasUnclosedParenthesis(line) ||
    next.startsWith("(") ||
    POS_TOKENS.has(next)
  )
}

function partsOfSpeech(expression) {
  const found = []

  for (const token of expression.match(/\b[a-z]+\b/g) ?? []) {
    const expanded = POS.get(token)

    if (expanded !== undefined && !found.includes(expanded)) {
      found.push(expanded)
    }
  }

  return found
}

/** Find the last balanced parenthetical group, allowing notes such as
 * `(UK sweet(s))` to contain their own parentheses. */
function lastGroup(text) {
  let depth = 0
  let start = -1
  let last = null

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "(") {
      if (depth === 0) {
        start = index
      }

      depth += 1
    } else if (text[index] === ")") {
      depth -= 1

      if (depth === 0 && start !== -1) {
        last = { start, content: text.slice(start + 1, index) }
      }
    }
  }

  return { last, balanced: depth === 0 }
}

/** `apartment (UK flat)` → text `apartment`, note `UK flat`. Inflection
 * markers such as `blond(e)` stay in the headword. */
function splitNote(text) {
  const { last, balanced } = lastGroup(text)

  if (last === null || !balanced || !text.endsWith(")")) {
    return { text, note: null }
  }

  const headword = text.slice(0, last.start).trim()
  const note = last.content.trim()

  if (headword === "" || /^[a-z]{1,3}$/.test(note)) {
    return { text, note: null }
  }

  return { text: headword, note }
}

/**
 * Expand only the parenthetical forms that are unambiguous: `blond(e)`,
 * `stair(s)`, `wake (up)`. Slash forms such as `city/town centre` and
 * `businessman/woman` are left exactly as Cambridge writes them.
 */
function variantsOf(text) {
  const inflection = /^(.*?)\s*\(([a-z]+|up)\)$/.exec(text)

  if (inflection === null) {
    return [text]
  }

  const headword = inflection[1].trim()
  const suffix = inflection[2]
  // `wake (up)` is a particle; `blond(e)` and `stair(s)` are inflections.
  const separator = suffix === "up" ? " " : ""

  return [headword, `${headword}${separator}${suffix}`]
}

/** Extraction sometimes spaces a name out (`Ka ty`, `To m`); compare without
 * spaces so the name is still removed from the A–Z list. */
function nameKey(text) {
  return text.toLowerCase().replace(/\s+/g, "")
}

function isName(text, names) {
  return names.has(nameKey(text))
}

const pages = (await readPages(pdfPath)).map((page, index) => ({
  index,
  level: detectLevel(page),
  lines: page.split(/\r?\n/).map((line) => line.trim()),
}))

const namesByLevel = new Map([
  [1, new Set()],
  [2, new Set()],
  [3, new Set()],
])

// Pass 1 — collect the names listed at the end of each band so that the same
// names can be removed from the A–Z list, where they carry a part of speech.
for (const page of pages) {
  if (page.level === null) {
    continue
  }

  let inNames = false

  for (const line of page.lines) {
    if (line === "Names") {
      inNames = true
      continue
    }

    if (!inNames || line === "" || line.startsWith("Candidates will be expected")) {
      continue
    }

    const name = line.replace(/\s*\(.*\)$/, "").trim()

    if (name !== "") {
      namesByLevel.get(page.level).add(nameKey(name))
    }
  }
}

const words = []
const problems = []
const seen = new Set()
const excludedByLevel = new Map([
  [1, 0],
  [2, 0],
  [3, 0],
])

let currentLevel = null
let seenFirstLetter = false
let inEntries = true

// Pass 2 — parse the A–Z entries.
for (const page of pages) {
  if (page.level === null) {
    continue
  }

  if (page.level !== currentLevel) {
    currentLevel = page.level
    seenFirstLetter = false
    inEntries = true
  }

  for (let lineIndex = 0; lineIndex < page.lines.length; lineIndex += 1) {
    let line = page.lines[lineIndex]

    if (line === "") {
      continue
    }

    if (!seenFirstLetter) {
      if (line === "A") {
        seenFirstLetter = true
      }

      continue
    }

    if (HEADERS.some(({ pattern }) => pattern.test(line))) {
      continue
    }

    if (SECTION_ENDINGS.has(line) || line === "Names") {
      inEntries = false
      continue
    }

    if (
      !inEntries ||
      line === "(No words at this level)" ||
      line.startsWith("Candidates will be expected")
    ) {
      continue
    }

    if (/^[A-Z]$/.test(line)) {
      continue
    }

    let parsed = parseLine(line)

    while (!isComplete(line, parsed)) {
      const next = page.lines[lineIndex + 1]

      if (next === undefined || !continues(line, next)) {
        break
      }

      line = `${line} ${next}`
      lineIndex += 1
      parsed = parseLine(line)
    }

    if (parsed.entries.length === 0) {
      // The only headwords without a part of speech are the time
      // abbreviations. Anything else is an extraction defect.
      if (/^[ap]\.m\./.test(line)) {
        parsed.entries.push({ text: line, posExpression: "" })
        parsed.remainder = ""
      } else {
        problems.push(`page ${page.index + 1}: could not parse "${line}"`)
        continue
      }
    }

    // A remainder means the line had trailing text after the last entry.
    // It is either part of a two-entry line we could not split or an
    // artifact; report it rather than guessing.
    if (parsed.remainder !== "") {
      problems.push(
        `page ${page.index + 1}: trailing text "${parsed.remainder}" in "${line}"`,
      )
      continue
    }

    for (const entry of parsed.entries) {
      const { text: headword, note } = splitNote(entry.text)

      if (isName(headword, namesByLevel.get(currentLevel))) {
        excludedByLevel.set(
          currentLevel,
          excludedByLevel.get(currentLevel) + 1,
        )
        continue
      }

      const variants = variantsOf(headword)
      const key = `${currentLevel}|${headword.toLowerCase()}|${note ?? ""}|${entry.posExpression}`

      if (seen.has(key)) {
        continue
      }

      seen.add(key)

      const record = {
        text: headword,
        level: currentLevel,
        partsOfSpeech: partsOfSpeech(entry.posExpression),
      }

      if (variants.length > 1) {
        record.variants = variants
      }

      if (note !== null) {
        record.note = note
      }

      if (/\s/.test(headword) || headword.includes("...")) {
        record.phrase = true
      }

      words.push(record)
    }
  }
}

if (problems.length > 0) {
  console.error("Extraction left lines it could not parse:")

  for (const problem of problems) {
    console.error(`  - ${problem}`)
  }

  process.exit(1)
}

const document = {
  source: {
    file: "docs/sample_data/739104-starters-movers-flyers-word-list-2025.pdf",
    title: "Pre A1 Starters, A1 Movers and A2 Flyers Wordlists",
    version: "2025",
  },
  levels: Object.fromEntries(LEVELS),
  words,
}

writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`)

for (const level of LEVELS.keys()) {
  const count = words.filter((word) => word.level === level).length

  console.log(
    `${LEVELS.get(level)}: ${count} entries (${excludedByLevel.get(level)} name entries excluded)`,
  )
}

console.log(`Wrote ${words.length} entries to ${outputPath}`)
