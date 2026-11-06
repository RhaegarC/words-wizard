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

const TOPIC_FIELDS = [
  "title",
  "titleZh",
  "icon",
  "description",
  "descriptionZh",
] as const

const PACK_FIELDS = ["topicId", "title", "titleZh"] as const
const PACK_PATCH_FIELDS = ["title", "titleZh"] as const

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
