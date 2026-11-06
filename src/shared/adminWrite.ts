import type { ContentBundle, ContentIssue, ContentIssueCode } from "./content/types"
import { validateContent } from "./content/validate"

/**
 * The shared write mechanics for the admin portal (feature 29).
 *
 * Everything here is decided from values alone, so it runs in the browser and
 * on the Worker without a database: id derivation, the version bump, request
 * parsing, and the validator pass. Feature 30 reuses the same pieces for
 * words and pack membership.
 */

/** Display titles are short labels; the cap keeps a derived id manageable. */
const MAX_SLUG_LENGTH = 40

/**
 * Lowercase, fold diacritics, collapse every run of non-alphanumerics to one
 * dash, and trim the ends. Non-Latin input has no ASCII slug at all; the
 * caller falls back to a numbered id.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    // NFKD splits an accented letter into base + combining mark; dropping
    // every non-ASCII character leaves the base ("é" → "e") and turns a
    // non-Latin title into the empty slug the caller falls back from.
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "")
}

/** `slug`, then `slug-2`, `slug-3`, …; the caller passes every taken id. */
export function topicIdFor(
  title: string,
  taken: ReadonlySet<string>,
): string {
  const base = slugify(title)

  if (base !== "") {
    if (!taken.has(base)) return base

    let suffix = 2
    while (taken.has(`${base}-${suffix}`)) suffix += 1
    return `${base}-${suffix}`
  }

  let number = 1
  while (taken.has(`topic-${number}`)) number += 1
  return `topic-${number}`
}

/** The smallest positive `<topicId>-<n>` the caller has not used yet. */
export function packIdFor(
  topicId: string,
  taken: ReadonlySet<string>,
): string {
  let number = 1
  while (taken.has(`${topicId}-${number}`)) number += 1
  return `${topicId}-${number}`
}

/** `w-<slug>`, then `w-<slug>-2`, …; a non-Latin headword falls back to `w-1`. */
export function wordIdFor(
  text: string,
  taken: ReadonlySet<string>,
): string {
  const base = slugify(text)

  if (base !== "") {
    const candidate = `w-${base}`
    if (!taken.has(candidate)) return candidate

    let suffix = 2
    while (taken.has(`${candidate}-${suffix}`)) suffix += 1
    return `${candidate}-${suffix}`
  }

  let number = 1
  while (taken.has(`w-${number}`)) number += 1
  return `w-${number}`
}

/**
 * The headword is unique case-insensitively across every row the caller
 * passes — active and archived — because the database index includes both.
 * `exceptId` lets an edit keep its own headword.
 */
export function headwordTaken(
  words: readonly { id: string; text: string }[],
  text: string,
  exceptId?: string,
): string | null {
  const key = text.trim().toLowerCase()

  for (const word of words) {
    if (word.id !== exceptId && word.text.trim().toLowerCase() === key) {
      return word.id
    }
  }

  return null
}

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/

/**
 * The patch component of the content version. A malformed value restarts at
 * `0.0.1` rather than throwing: the version is server state, and a broken one
 * must not make every save fail.
 */
export function bumpContentVersion(contentVersion: string): string {
  const match = VERSION.exec(contentVersion)
  if (match === null) return "0.0.1"

  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

export type WriteIssue =
  | "invalid-payload"
  | "unknown-field"
  | "missing-field"
  | "invalid-id"
  | "duplicate-id"
  | "empty-patch"
  | "invalid-examples"
  | "invalid-level"
  | "invalid-tags"
  | "invalid-emoji"
  | "list-too-long"

export type ParsedWrite<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly WriteIssue[] }

export interface TopicCreatePayload {
  title: string
  titleZh: string
  icon: string
  description: string
  descriptionZh: string
}

export type TopicPatchPayload = Partial<TopicCreatePayload>

export interface PackCreatePayload {
  topicId: string
  title: string
  titleZh: string
}

export type PackPatchPayload = Partial<Pick<PackCreatePayload, "title" | "titleZh">>

export interface TopicOrderPayload {
  ids: string[]
}

export interface PackOrderPayload {
  topicId: string
  ids: string[]
}

/** The array caps bound one save's payload and one membership batch. */
export const MAX_EXAMPLES = 8
export const MAX_TAGS = 20
export const MAX_MEMBERSHIP = 500
export const MAX_EMOJI_LENGTH = 32

export interface WordExamplePayload {
  en: string
  zh: string
}

export interface WordCreatePayload {
  text: string
  phonetic: string
  partOfSpeech: string
  meaningEn: string
  meaningZh: string
  definitionEn: string
  definitionZh: string
  examples: WordExamplePayload[]
  level: 1 | 2 | 3
  tags: string[]
  emoji: string | null
  /** Optional: places the new word at the end of this pack atomically. */
  packId?: string
}

export type WordPatchPayload = Partial<Omit<WordCreatePayload, "packId">>

/** The full ordered membership of one pack; an empty list empties it. */
export interface MembershipPayload {
  ids: string[]
}

const TOPIC_FIELDS = [
  "title",
  "titleZh",
  "icon",
  "description",
  "descriptionZh",
] as const

const PACK_FIELDS = ["topicId", "title", "titleZh"] as const
const PACK_PATCH_FIELDS = ["title", "titleZh"] as const

const WORD_TEXT_FIELDS = [
  "text",
  "phonetic",
  "partOfSpeech",
  "meaningEn",
  "meaningZh",
  "definitionEn",
  "definitionZh",
] as const

const WORD_FIELDS = [...WORD_TEXT_FIELDS, "examples", "level", "tags", "emoji"] as const
const WORD_CREATE_FIELDS = [...WORD_FIELDS, "packId"] as const

type TopicField = typeof TOPIC_FIELDS[number]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function addUnknownFields(
  body: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  issues: WriteIssue[],
): void {
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) issues.push("unknown-field")
  }
}

/** A required field is a non-blank string; the value is returned trimmed. */
function stringField(
  body: Record<string, unknown>,
  key: string,
  issues: WriteIssue[],
): string | null {
  const raw = body[key]
  if (typeof raw !== "string" || raw.trim() === "") {
    issues.push("missing-field")
    return null
  }

  return raw.trim()
}

export function parseTopicCreate(body: unknown): ParsedWrite<TopicCreatePayload> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  const issues: WriteIssue[] = []
  addUnknownFields(body, new Set(TOPIC_FIELDS), issues)

  const values: Partial<TopicCreatePayload> = {}

  for (const field of TOPIC_FIELDS) {
    const value = stringField(body, field, issues)
    if (value !== null) values[field as TopicField] = value
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: values as TopicCreatePayload }
}

export function parseTopicPatch(body: unknown): ParsedWrite<TopicPatchPayload> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  if (Object.keys(body).length === 0) return { ok: false, issues: ["empty-patch"] }

  const issues: WriteIssue[] = []
  addUnknownFields(body, new Set(TOPIC_FIELDS), issues)

  const value: TopicPatchPayload = {}

  for (const field of TOPIC_FIELDS) {
    if (!(field in body)) continue

    const parsed = stringField(body, field, issues)
    if (parsed !== null) value[field as TopicField] = parsed
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value }
}

export function parsePackCreate(body: unknown): ParsedWrite<PackCreatePayload> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  const issues: WriteIssue[] = []
  addUnknownFields(body, new Set(PACK_FIELDS), issues)

  const topicId = stringField(body, "topicId", issues)
  const title = stringField(body, "title", issues)
  const titleZh = stringField(body, "titleZh", issues)

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: { topicId: topicId!, title: title!, titleZh: titleZh! } }
}

export function parsePackPatch(body: unknown): ParsedWrite<PackPatchPayload> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  if (Object.keys(body).length === 0) return { ok: false, issues: ["empty-patch"] }

  const issues: WriteIssue[] = []
  addUnknownFields(body, new Set(PACK_PATCH_FIELDS), issues)

  const value: PackPatchPayload = {}

  for (const field of PACK_PATCH_FIELDS) {
    if (!(field in body)) continue

    const parsed = stringField(body, field, issues)
    if (parsed !== null) value[field] = parsed
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value }
}

interface ParsedIds {
  readonly ids: string[]
  readonly issues: WriteIssue[]
}

function parseIds(raw: unknown): ParsedIds {
  if (!Array.isArray(raw)) return { ids: [], issues: ["invalid-payload"] }

  const ids: string[] = []
  const seen = new Set<string>()
  const issues: WriteIssue[] = []

  for (const entry of raw) {
    if (typeof entry !== "string" || entry.trim() === "") {
      issues.push("invalid-id")
      continue
    }

    const id = entry.trim()
    if (seen.has(id)) {
      issues.push("duplicate-id")
      continue
    }

    seen.add(id)
    ids.push(id)
  }

  return { ids, issues }
}

export function parseTopicOrder(body: unknown): ParsedWrite<TopicOrderPayload> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  const issues: WriteIssue[] = []
  addUnknownFields(body, new Set(["ids"]), issues)

  const parsed = parseIds(body.ids)
  issues.push(...parsed.issues)

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: { ids: parsed.ids } }
}

export function parsePackOrder(body: unknown): ParsedWrite<PackOrderPayload> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  const issues: WriteIssue[] = []
  addUnknownFields(body, new Set(["topicId", "ids"]), issues)

  const topicId = stringField(body, "topicId", issues)
  const parsed = parseIds(body.ids)
  issues.push(...parsed.issues)

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: { topicId: topicId!, ids: parsed.ids } }
}

/** One or more bilingual pairs; each needs both languages. */
function parseExamples(raw: unknown, issues: WriteIssue[]): WordExamplePayload[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_EXAMPLES) {
    issues.push("invalid-examples")
    return []
  }

  const examples: WordExamplePayload[] = []

  for (const entry of raw) {
    if (!isRecord(entry)) {
      issues.push("invalid-examples")
      continue
    }

    for (const key of Object.keys(entry)) {
      if (key !== "en" && key !== "zh") issues.push("unknown-field")
    }

    const en = typeof entry.en === "string" ? entry.en.trim() : ""
    const zh = typeof entry.zh === "string" ? entry.zh.trim() : ""

    if (en === "" || zh === "") {
      issues.push("invalid-examples")
      continue
    }

    examples.push({ en, zh })
  }

  return examples
}

function parseLevel(raw: unknown, issues: WriteIssue[]): 1 | 2 | 3 {
  if (raw === 1 || raw === 2 || raw === 3) return raw

  issues.push("invalid-level")
  return 1
}

/** Trimmed, de-duplicated, and capped; an empty list is valid. */
function parseTags(raw: unknown, issues: WriteIssue[]): string[] {
  if (!Array.isArray(raw)) {
    issues.push("invalid-tags")
    return []
  }

  const tags: string[] = []

  for (const entry of raw) {
    if (typeof entry !== "string" || entry.trim() === "") {
      issues.push("invalid-tags")
      continue
    }

    const tag = entry.trim()
    if (!tags.includes(tag)) tags.push(tag)
  }

  if (tags.length > MAX_TAGS) issues.push("invalid-tags")
  return tags
}

/** Emoji is optional text: null and blank both mean "none". */
function parseEmoji(
  raw: unknown,
  issues: WriteIssue[],
): string | null {
  if (raw === undefined || raw === null) return null

  if (typeof raw !== "string") {
    issues.push("invalid-emoji")
    return null
  }

  const emoji = raw.trim()
  if (emoji === "") return null
  if (emoji.length > MAX_EMOJI_LENGTH) issues.push("invalid-emoji")

  return emoji
}

function wordTextFields(
  body: Record<string, unknown>,
  issues: WriteIssue[],
): Record<(typeof WORD_TEXT_FIELDS)[number], string> {
  const values = {} as Record<(typeof WORD_TEXT_FIELDS)[number], string>

  for (const field of WORD_TEXT_FIELDS) {
    const value = stringField(body, field, issues)
    if (value !== null) values[field] = value
  }

  return values
}

export function parseWordCreate(body: unknown): ParsedWrite<WordCreatePayload> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  const issues: WriteIssue[] = []
  addUnknownFields(body, new Set(WORD_CREATE_FIELDS), issues)

  const texts = wordTextFields(body, issues)
  const examples = parseExamples(body.examples, issues)
  const level = parseLevel(body.level, issues)
  const tags = parseTags(body.tags, issues)
  const emoji = parseEmoji(body.emoji, issues)
  const packId =
    body.packId === undefined ? undefined : stringField(body, "packId", issues)

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    value: {
      ...texts,
      examples,
      level,
      tags,
      emoji,
      ...(packId === null || packId === undefined ? {} : { packId }),
    },
  }
}

export function parseWordPatch(body: unknown): ParsedWrite<WordPatchPayload> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  if (Object.keys(body).length === 0) return { ok: false, issues: ["empty-patch"] }

  const issues: WriteIssue[] = []
  addUnknownFields(body, new Set(WORD_FIELDS), issues)

  const value: WordPatchPayload = {}

  for (const field of WORD_TEXT_FIELDS) {
    if (!(field in body)) continue

    const parsed = stringField(body, field, issues)
    if (parsed !== null) value[field] = parsed
  }

  if ("examples" in body) value.examples = parseExamples(body.examples, issues)
  if ("level" in body) value.level = parseLevel(body.level, issues)
  if ("tags" in body) value.tags = parseTags(body.tags, issues)
  if ("emoji" in body) value.emoji = parseEmoji(body.emoji, issues)

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value }
}

export function parseMembership(body: unknown): ParsedWrite<MembershipPayload> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  const issues: WriteIssue[] = []
  addUnknownFields(body, new Set(["ids"]), issues)

  const parsed = parseIds(body.ids)
  issues.push(...parsed.issues)

  if (Array.isArray(body.ids) && body.ids.length > MAX_MEMBERSHIP) {
    issues.push("list-too-long")
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: { ids: parsed.ids } }
}

/**
 * The editor is incremental, so an empty topic or pack is a warning rather
 * than a blocking error. Every other structural finding still blocks.
 */
const INCREMENTAL_CODES = new Set<ContentIssueCode>([
  "topic-no-packs",
  "pack-no-words",
])

export interface ProposalCheck {
  readonly errors: readonly ContentIssue[]
  readonly warnings: readonly ContentIssue[]
}

/** Run the shared validator over the content as it would be after the write. */
export function checkProposal(bundle: ContentBundle): ProposalCheck {
  const issues = validateContent(bundle).map((issue) =>
    INCREMENTAL_CODES.has(issue.code)
      ? { ...issue, severity: "warning" as const }
      : issue,
  )

  return {
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  }
}
