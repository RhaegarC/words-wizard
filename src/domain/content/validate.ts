import { STAGE_IDS, type Word } from "../types"

import type {
  ContentBundle,
  ContentIssue,
  ContentIssueCode,
  IssueSeverity,
} from "./types"

export interface ValidateOptions {
  /** Loaded from `content/forbidden-terms.json`; kept out of code. */
  forbiddenTerms?: readonly string[]
  /** Injected by the runner so the pure validator never touches the disk. */
  artExists?: (file: string) => boolean
}

const REQUIRED_TOPICS = 5
const PACKS_PER_TOPIC = 3
const SLOTS_PER_PACK = 20
const FINAL_WORD_CAP = 300

const WORD_TEXT_FIELDS = [
  "text",
  "phonetic",
  "partOfSpeech",
  "meaningEn",
  "meaningZh",
  "definitionEn",
  "definitionZh",
] as const

/**
 * Check a bundle against the content contract (feature 04). Returns every
 * finding instead of throwing on the first, so an author gets the whole list.
 * Severity depends on the dataset: incomplete art and unresolved word slots
 * are tolerated while authoring (`dev`) and fatal once content is final.
 */
export function validateContent(
  bundle: ContentBundle,
  options: ValidateOptions = {},
): ContentIssue[] {
  const issues: ContentIssue[] = []
  const dataset = bundle.meta.dataset
  const artSeverity: IssueSeverity = dataset === "final" ? "error" : "warning"
  const artExists = options.artExists ?? (() => true)
  const forbiddenTerms = options.forbiddenTerms ?? []

  const add = (
    code: ContentIssueCode,
    severity: IssueSeverity,
    file: string,
    id: string,
    message: string,
  ) => {
    issues.push({ code, severity, file, id, message })
  }

  const error = (
    code: ContentIssueCode,
    file: string,
    id: string,
    message: string,
  ) => add(code, "error", file, id, message)

  const topicsById = new Map(bundle.topics.map((topic) => [topic.id, topic]))
  const packsById = new Map(bundle.packs.map((pack) => [pack.id, pack]))
  const wordsById = new Map<string, Word>()

  for (const word of bundle.words) {
    if (!wordsById.has(word.id)) {
      wordsById.set(word.id, word)
    }
  }

  // Rule 1 — structure.
  if (bundle.topics.length !== REQUIRED_TOPICS) {
    error(
      "topic-count",
      "topics.json",
      "",
      `Expected ${REQUIRED_TOPICS} topics, found ${bundle.topics.length}.`,
    )
  }

  for (const topic of bundle.topics) {
    if (topic.packIds.length !== PACKS_PER_TOPIC) {
      error(
        "pack-count",
        "topics.json",
        topic.id,
        `Topic "${topic.id}" must have ${PACKS_PER_TOPIC} packs, found ${topic.packIds.length}.`,
      )
    }
  }

  for (const pack of bundle.packs) {
    if (pack.wordIds.length !== SLOTS_PER_PACK) {
      error(
        "pack-slots",
        "packs.json",
        pack.id,
        `Pack "${pack.id}" must have ${SLOTS_PER_PACK} word slots, found ${pack.wordIds.length}.`,
      )
    }
  }

  // Rule 2 — unique ids and resolving references.
  for (const [file, items] of [
    ["topics.json", bundle.topics],
    ["packs.json", bundle.packs],
    ["words.json", bundle.words],
  ] as const) {
    for (const id of findDuplicates(items)) {
      error("duplicate-id", file, id, `Duplicate id "${id}" in ${file}.`)
    }
  }

  for (const pack of bundle.packs) {
    if (!topicsById.has(pack.topicId)) {
      error(
        "pack-topic-ref",
        "packs.json",
        pack.id,
        `Pack "${pack.id}" references unknown topic "${pack.topicId}".`,
      )
    }

    for (const wordId of pack.wordIds) {
      if (!wordsById.has(wordId)) {
        add(
          "pack-word-ref",
          dataset === "final" ? "error" : "warning",
          "packs.json",
          wordId,
          `Pack "${pack.id}" references unknown word "${wordId}".`,
        )
      }
    }
  }

  for (const topic of bundle.topics) {
    for (const packId of topic.packIds) {
      if (!packsById.has(packId)) {
        error(
          "topic-pack-ref",
          "topics.json",
          topic.id,
          `Topic "${topic.id}" references unknown pack "${packId}".`,
        )
      }
    }
  }

  for (const word of bundle.words) {
    for (const topicId of word.topicIds) {
      if (!topicsById.has(topicId)) {
        error(
          "word-topic-ref",
          "words.json",
          word.id,
          `Word "${word.id}" references unknown topic "${topicId}".`,
        )
      }
    }
  }

  // Rules 3–6 and 11 — the word record itself.
  for (const word of bundle.words) {
    if (word.level !== 1 && word.level !== 2 && word.level !== 3) {
      error(
        "bad-level",
        "words.json",
        word.id,
        `Word "${word.id}" has level ${word.level}; expected 1, 2, or 3.`,
      )
    }

    for (const field of WORD_TEXT_FIELDS) {
      if (typeof word[field] !== "string" || word[field].trim() === "") {
        error(
          "word-empty-field",
          "words.json",
          word.id,
          `Word "${word.id}" has an empty "${field}".`,
        )
      }
    }

    if (word.examples.length === 0) {
      error(
        "word-no-examples",
        "words.json",
        word.id,
        `Word "${word.id}" has no examples.`,
      )
    } else {
      word.examples.forEach((example, index) => {
        const missing = [
          example.en.trim() === "" ? "en" : "",
          example.zh.trim() === "" ? "zh" : "",
        ].filter(Boolean)

        if (missing.length > 0) {
          error(
            "example-unpaired",
            "words.json",
            word.id,
            `Word "${word.id}" example ${index + 1} is missing ${missing.join(" and ")}.`,
          )
        }
      })

      const firstEnglish = word.examples[0].en

      if (
        firstEnglish.trim() !== "" &&
        !containsTerm(firstEnglish, word.text)
      ) {
        error(
          "example-missing-word",
          "words.json",
          word.id,
          `Word "${word.id}" first English example does not contain "${word.text}".`,
        )
      }
    }

    // Rule 7 — artwork file and manifest entry.
    const artwork = bundle.artwork[word.id]

    if (!artwork) {
      error(
        "art-manifest-missing",
        "art/manifest.json",
        word.id,
        `Word "${word.id}" has no artwork manifest entry.`,
      )
    } else if (!artExists(artwork.file)) {
      add(
        "art-missing",
        artSeverity,
        "art/manifest.json",
        word.id,
        `Artwork file "${artwork.file}" for "${word.id}" does not exist.`,
      )
    } else if (artwork.status === "placeholder") {
      add(
        "art-placeholder",
        artSeverity,
        "art/manifest.json",
        word.id,
        `Artwork for "${word.id}" is still a placeholder.`,
      )
    }
  }

  // Rule 8 — forbidden IP terms, from data.
  for (const term of forbiddenTerms) {
    for (const topic of bundle.topics) {
      scanFields(
        [
          ["title", topic.title],
          ["titleZh", topic.titleZh],
          ["description", topic.description],
          ["descriptionZh", topic.descriptionZh],
        ],
        term,
        "topics.json",
        topic.id,
      )
    }

    for (const pack of bundle.packs) {
      scanFields(
        [
          ["title", pack.title],
          ["titleZh", pack.titleZh],
        ],
        term,
        "packs.json",
        pack.id,
      )
    }

    for (const word of bundle.words) {
      scanFields(
        [
          ["text", word.text],
          ["phonetic", word.phonetic],
          ["meaningEn", word.meaningEn],
          ["meaningZh", word.meaningZh],
          ["definitionEn", word.definitionEn],
          ["definitionZh", word.definitionZh],
          ...word.examples.flatMap((example, index) => [
            [`examples[${index}].en`, example.en] as const,
            [`examples[${index}].zh`, example.zh] as const,
          ]),
        ],
        term,
        "words.json",
        word.id,
      )
    }
  }

  // Rule 9 — order and unlock values.
  for (const topic of bundle.topics) {
    const seenOrders = new Set<number>()

    for (const pack of bundle.packs.filter(
      (candidate) => candidate.topicId === topic.id,
    )) {
      if (
        ![1, 2, 3].includes(pack.order) ||
        seenOrders.has(pack.order)
      ) {
        error(
          "pack-order",
          "packs.json",
          pack.id,
          `Pack "${pack.id}" order ${pack.order} is not unique 1..3 within "${topic.id}".`,
        )
      }

      seenOrders.add(pack.order)
    }
  }

  for (const pack of bundle.packs) {
    if (
      pack.unlockRule.type !== "masteryCount" ||
      ![0, 15, 30].includes(pack.unlockRule.value)
    ) {
      error(
        "bad-unlock",
        "packs.json",
        pack.id,
        `Pack "${pack.id}" has unlock value ${pack.unlockRule.value}; expected 0, 15, or 30.`,
      )
    }
  }

  // Rule 10 — the final dataset must be complete.
  if (dataset === "final" && bundle.words.length > FINAL_WORD_CAP) {
    error(
      "final-distinct-words",
      "words.json",
      "",
      `Final dataset has ${bundle.words.length} distinct words; the cap is ${FINAL_WORD_CAP}.`,
    )
  }

  // Rule 12 — abstract/emotional words, by topic and in each pack's final third.
  for (const topic of bundle.topics) {
    const topicWords = bundle.words.filter((word) =>
      word.topicIds.includes(topic.id),
    )

    if (topicWords.length > 0 && !hasAbstract(topicWords)) {
      error(
        "abstract-word-missing",
        "topics.json",
        topic.id,
        `Topic "${topic.id}" has no abstract/emotional word.`,
      )
    }
  }

  for (const pack of bundle.packs) {
    const start = Math.floor((pack.wordIds.length * 2) / 3)
    const finalThird = pack.wordIds
      .slice(start)
      .map((wordId) => wordsById.get(wordId))
      .filter((word): word is Word => word !== undefined)

    // Unresolved slots are already reported, and an unauthored pack in `dev`
    // has nothing to judge here.
    if (finalThird.length > 0 && !hasAbstract(finalThird)) {
      error(
        "abstract-word-missing",
        "packs.json",
        pack.id,
        `Pack "${pack.id}" final third has no abstract/emotional word.`,
      )
    }
  }

  // Avatar shape: three identities, every stage present.
  if (bundle.avatars.length !== 3) {
    error(
      "avatar-count",
      "avatars.json",
      "",
      `Expected 3 avatars, found ${bundle.avatars.length}.`,
    )
  }

  for (const avatar of bundle.avatars) {
    for (const stage of STAGE_IDS) {
      if (!avatar.stages[stage]) {
        error(
          "avatar-stage-missing",
          "avatars.json",
          avatar.id,
          `Avatar "${avatar.id}" is missing stage "${stage}".`,
        )
      }
    }
  }

  return issues

  function scanFields(
    fields: ReadonlyArray<readonly [string, string]>,
    term: string,
    file: string,
    id: string,
  ) {
    for (const [field, value] of fields) {
      if (value && containsTerm(value, term)) {
        error(
          "forbidden-term",
          file,
          id,
          `${id} uses forbidden term "${term}" in ${field}.`,
        )
      }
    }
  }
}

export function hasErrors(issues: readonly ContentIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error")
}

function findDuplicates(items: readonly { id: string }[]): readonly string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.add(item.id)
    }

    seen.add(item.id)
  }

  return [...duplicates]
}

function hasAbstract(words: readonly Word[]): boolean {
  return words.some((word) => word.tags.includes("abstract"))
}

/** Case-insensitive match on a word boundary, so "build" does not match
 * "building" and a forbidden term does not match inside a longer word. */
export function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text)
}
