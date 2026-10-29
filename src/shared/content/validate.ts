import { STAGE_IDS, type Word } from "../types"

import type {
  ContentBundle,
  ContentIssue,
  ContentIssueCode,
  IssueSeverity,
} from "./types"

export interface ValidateOptions {
  /** Loaded from `shared/content/rules/forbidden-terms.json`; kept out of code. */
  forbiddenTerms?: readonly string[]
  /** The Cambridge headword list; editorial, checked at `final` only. */
  allowlist?: readonly string[]
}

const REQUIRED_AVATARS = 8

const WORD_TEXT_FIELDS = [
  "text",
  "phonetic",
  "partOfSpeech",
  "meaningEn",
  "meaningZh",
  "definitionEn",
  "definitionZh",
] as const

/** `http(s)://…` with a host and no whitespace. */
const ABSOLUTE_URL = /^https?:\/\/[^\s/]+(\/\S*)?$/i

/**
 * Check a bundle against the content contract (features 04, 17, and 22).
 * Returns every finding instead of throwing on the first, so an author gets
 * the whole list.
 *
 * Structural rules always fail: shape, references, duplicates, and the word
 * record. Editorial rules — allowlist, abstract coverage, the first example
 * containing the headword, forbidden IP terms — are warnings while authoring
 * (`dev`) and errors once the dataset is `final`.
 */
export function validateContent(
  bundle: ContentBundle,
  options: ValidateOptions = {},
): ContentIssue[] {
  const issues: ContentIssue[] = []
  const dataset = bundle.meta.dataset
  const editorial: IssueSeverity = dataset === "final" ? "error" : "warning"
  const allowlist =
    options.allowlist === undefined
      ? undefined
      : new Set(options.allowlist.map((word) => word.toLowerCase()))
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
  const wordsById = new Map<string, Word>()

  for (const word of bundle.words) {
    if (!wordsById.has(word.id)) {
      wordsById.set(word.id, word)
    }
  }

  // Unique ids.
  for (const [file, items] of [
    ["topics", bundle.topics],
    ["packs", bundle.packs],
    ["words", bundle.words],
  ] as const) {
    for (const id of findDuplicates(items)) {
      error("duplicate-id", file, id, `Duplicate id "${id}" in ${file}.`)
    }
  }

  // A headword appears once; extra senses stay in the same row.
  const textSeen = new Map<string, string>()

  for (const word of bundle.words) {
    const key = word.text.trim().toLowerCase()
    const firstId = textSeen.get(key)

    if (firstId !== undefined) {
      error(
        "word-text-duplicate",
        "words",
        word.id,
        `Word "${word.id}" repeats the headword "${word.text}" already used by "${firstId}".`,
      )
    } else {
      textSeen.set(key, word.id)
    }
  }

  // References resolve, and every served row has a parent.
  const packedTopicIds = new Set(bundle.packs.map((pack) => pack.topicId))

  for (const topic of bundle.topics) {
    if (!packedTopicIds.has(topic.id)) {
      error(
        "topic-no-packs",
        "topics",
        topic.id,
        `Topic "${topic.id}" has no pack.`,
      )
    }
  }

  for (const pack of bundle.packs) {
    if (!topicsById.has(pack.topicId)) {
      error(
        "pack-topic-ref",
        "packs",
        pack.id,
        `Pack "${pack.id}" references unknown topic "${pack.topicId}".`,
      )
    }

    if (pack.wordIds.length === 0) {
      error("pack-no-words", "packs", pack.id, `Pack "${pack.id}" has no word.`)
    }

    for (const wordId of new Set(findDuplicates(pack.wordIds.map((id) => ({ id }))))) {
      error(
        "pack-duplicate-word",
        "packs",
        pack.id,
        `Pack "${pack.id}" lists word "${wordId}" more than once.`,
      )
    }

    for (const wordId of pack.wordIds) {
      if (!wordsById.has(wordId)) {
        error(
          "pack-word-ref",
          "packs",
          wordId,
          `Pack "${pack.id}" references unknown word "${wordId}".`,
        )
      }
    }
  }

  for (const word of bundle.words) {
    if (word.topicIds.length === 0) {
      error(
        "word-no-topic",
        "words",
        word.id,
        `Word "${word.id}" is served without an active topic.`,
      )
    }

    for (const topicId of word.topicIds) {
      if (!topicsById.has(topicId)) {
        error(
          "word-topic-ref",
          "words",
          word.id,
          `Word "${word.id}" references unknown topic "${topicId}".`,
        )
      }
    }
  }

  // The word record itself.
  for (const word of bundle.words) {
    if (word.level !== 1 && word.level !== 2 && word.level !== 3) {
      error(
        "bad-level",
        "words",
        word.id,
        `Word "${word.id}" has level ${word.level}; expected 1, 2, or 3.`,
      )
    }

    for (const field of WORD_TEXT_FIELDS) {
      if (typeof word[field] !== "string" || word[field].trim() === "") {
        error(
          "word-empty-field",
          "words",
          word.id,
          `Word "${word.id}" has an empty "${field}".`,
        )
      }
    }

    if (word.image !== null && !ABSOLUTE_URL.test(word.image)) {
      error(
        "image-url",
        "words",
        word.id,
        `Word "${word.id}" image must be an absolute URL or null.`,
      )
    }

    if (word.examples.length === 0) {
      error(
        "word-no-examples",
        "words",
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
            "words",
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
        add(
          "example-missing-word",
          editorial,
          "words",
          word.id,
          `Word "${word.id}" first English example does not contain "${word.text}".`,
        )
      }
    }

    if (allowlist !== undefined && !allowlist.has(word.text.trim().toLowerCase())) {
      add(
        "word-not-in-allowlist",
        editorial,
        "words",
        word.id,
        `Word "${word.id}" ("${word.text}") is not in the Cambridge allowlist.`,
      )
    }
  }

  // Forbidden IP terms, from data, never from code.
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
        "topics",
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
        "packs",
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
        "words",
        word.id,
      )
    }
  }

  // Abstract/emotional words, by topic and in each pack's final third.
  for (const topic of bundle.topics) {
    const topicWords = bundle.words.filter((word) =>
      word.topicIds.includes(topic.id),
    )

    if (topicWords.length > 0 && !hasAbstract(topicWords)) {
      add(
        "abstract-word-missing",
        editorial,
        "topics",
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

    if (finalThird.length > 0 && !hasAbstract(finalThird)) {
      add(
        "abstract-word-missing",
        editorial,
        "packs",
        pack.id,
        `Pack "${pack.id}" final third has no abstract/emotional word.`,
      )
    }
  }

  // Avatar shape: one identity per buddy, every stage present.
  if (bundle.avatars.length !== REQUIRED_AVATARS) {
    error(
      "avatar-count",
      "avatars",
      "",
      `Expected ${REQUIRED_AVATARS} avatars, found ${bundle.avatars.length}.`,
    )
  }

  for (const avatar of bundle.avatars) {
    for (const stage of STAGE_IDS) {
      if (!avatar.stages[stage]) {
        error(
          "avatar-stage-missing",
          "avatars",
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
        add(
          "forbidden-term",
          editorial,
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
