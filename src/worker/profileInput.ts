import { validateCharacterName } from "../shared/characterName"
import type { CareAction, CreateProfileInput, ProfilePatchInput } from "../shared/me"
import { CARE_ACTIONS } from "../shared/me"
import { METRIC_NAME_VALUES } from "../shared/metrics"
import type { MetricName } from "../shared/metrics"
import type { Locale } from "../shared/types"

/**
 * Unit-tier request rules for the user-data routes: everything decided from the
 * body alone, before a single database call.
 *
 * Unknown fields are a rejection, not a silent ignore. A body carrying `oid`
 * or `profileId` must never look accepted, and the server-owned profile fields
 * (`xp`, streak, tokens) are refused where they could otherwise be written.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_EVENT_ID_LENGTH = 64
const SIGNED_METRIC: MetricName = "monthlyReview.strengthDelta"

/** A JSON body over this is refused before `JSON.parse` runs. */
export const MAX_BODY_BYTES = 64 * 1024

export type JsonBodyResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly issue: "body-too-large" | "invalid-json" }

/**
 * The size guard runs twice on purpose: a declared `Content-Length` is refused
 * before the text is touched, and the actual byte length is checked because a
 * chunked request declares nothing.
 */
export function parseJsonBody(
  contentLength: string | undefined,
  text: string,
): JsonBodyResult {
  const declared =
    contentLength === undefined || contentLength.trim() === ""
      ? null
      : Number(contentLength)

  if (declared !== null && Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, issue: "body-too-large" }
  }

  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, issue: "body-too-large" }
  }

  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, issue: "invalid-json" }
  }
}

export type ProfileInputIssue =
  | "invalid-payload"
  | "unknown-field"
  | "empty-patch"
  | "name-invalid"
  | "avatar-invalid"
  | "topic-invalid"
  | "locale-invalid"
  | "clock-out-of-range"

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ProfileInputIssue[] }

export interface CreateProfileValue extends CreateProfileInput {
  readonly now: number
}

const CREATE_FIELDS = new Set([
  "characterName",
  "avatar",
  "currentTopicId",
  "locale",
  "now",
])

const PATCH_FIELDS = new Set([
  "characterName",
  "avatar",
  "currentTopicId",
  "locale",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function unknownFields(
  body: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  issues: ProfileInputIssue[],
): void {
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) issues.push("unknown-field")
  }
}

function nameIssue(body: Record<string, unknown>): ProfileInputIssue | null {
  const raw = body.characterName
  if (typeof raw !== "string") return "name-invalid"

  return validateCharacterName(raw).ok ? null : "name-invalid"
}

function avatarIssue(body: Record<string, unknown>): ProfileInputIssue | null {
  const raw = body.avatar
  return typeof raw === "string" && raw.trim() !== ""
    ? null
    : "avatar-invalid"
}

function topicIssue(body: Record<string, unknown>): ProfileInputIssue | null {
  // Creation may omit the topic; the picker fills it later.
  if (body.currentTopicId === null || body.currentTopicId === undefined) {
    return null
  }

  const raw = body.currentTopicId
  return typeof raw === "string" && raw.trim() !== ""
    ? null
    : "topic-invalid"
}

function localeIssue(body: Record<string, unknown>): ProfileInputIssue | null {
  return body.locale === "en" || body.locale === "zh"
    ? null
    : "locale-invalid"
}

export function parseCreateProfile(
  body: unknown,
  serverNow: number,
): Parsed<CreateProfileValue> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  const issues: ProfileInputIssue[] = []
  const add = (issue: ProfileInputIssue | null) => {
    if (issue !== null) issues.push(issue)
  }

  unknownFields(body, CREATE_FIELDS, issues)
  add(nameIssue(body))
  add(avatarIssue(body))
  add(topicIssue(body))
  add(localeIssue(body))

  // The client's clock is trusted only inside a day of the server's.
  const now = body.now
  if (
    typeof now !== "number" ||
    !Number.isFinite(now) ||
    Math.abs(now - serverNow) > DAY_MS
  ) {
    add("clock-out-of-range")
  }

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    value: {
      characterName: (body.characterName as string).trim(),
      avatar: (body.avatar as string).trim(),
      currentTopicId:
        body.currentTopicId === null || body.currentTopicId === undefined
          ? null
          : (body.currentTopicId as string).trim(),
      locale: body.locale as Locale,
      now: now as number,
    },
  }
}

export function parseProfilePatch(body: unknown): Parsed<ProfilePatchInput> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  const issues: ProfileInputIssue[] = []
  const add = (issue: ProfileInputIssue | null) => {
    if (issue !== null) issues.push(issue)
  }

  unknownFields(body, PATCH_FIELDS, issues)

  if (Object.keys(body).length === 0) {
    return { ok: false, issues: ["empty-patch"] }
  }

  // Fixed field order keeps the issue list stable regardless of key order.
  if ("characterName" in body) add(nameIssue(body))
  if ("avatar" in body) add(avatarIssue(body))
  if ("currentTopicId" in body) add(topicIssue(body))
  if ("locale" in body) add(localeIssue(body))

  if (issues.length > 0) return { ok: false, issues }

  const value: ProfilePatchInput = {}

  if ("characterName" in body) {
    value.characterName = (body.characterName as string).trim()
  }
  if ("avatar" in body) {
    value.avatar = (body.avatar as string).trim()
  }
  if ("currentTopicId" in body) {
    value.currentTopicId =
      body.currentTopicId === null ? null : (body.currentTopicId as string).trim()
  }
  if ("locale" in body) {
    value.locale = body.locale as Locale
  }

  return { ok: true, value }
}

export type EventInputIssue =
  | "invalid-payload"
  | "unknown-field"
  | "metric-name-invalid"
  | "metric-delta-invalid"
  | "event-id-invalid"
  | "care-action-invalid"

export type EventParse<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly EventInputIssue[] }

export interface MetricEventValue {
  readonly name: MetricName
  readonly delta: number
  readonly eventId: string
}

export interface CareEventValue {
  readonly action: CareAction
  readonly eventId: string
}

const METRIC_FIELDS = new Set(["name", "delta", "eventId"])
const CARE_FIELDS = new Set(["action", "eventId"])

function eventIdIssue(body: Record<string, unknown>): EventInputIssue | null {
  const eventId = body.eventId
  return typeof eventId === "string" &&
    eventId.trim() !== "" &&
    eventId.trim().length <= MAX_EVENT_ID_LENGTH
    ? null
    : "event-id-invalid"
}

/** The same name and delta rules the session commit applies. */
export function parseMetricEvent(body: unknown): EventParse<MetricEventValue> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  const issues: EventInputIssue[] = []
  const add = (issue: EventInputIssue | null) => {
    if (issue !== null) issues.push(issue)
  }

  for (const key of Object.keys(body)) {
    if (!METRIC_FIELDS.has(key)) issues.push("unknown-field")
  }

  const name = body.name
  const known = METRIC_NAME_VALUES.includes(name as MetricName)
  if (!known) issues.push("metric-name-invalid")

  const delta = body.delta
  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    issues.push("metric-delta-invalid")
  } else if (known && name === SIGNED_METRIC) {
    if (delta < -1 || delta > 1) issues.push("metric-delta-invalid")
  } else if (delta < 0) {
    issues.push("metric-delta-invalid")
  }

  add(eventIdIssue(body))

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    value: {
      name: name as MetricName,
      delta: delta as number,
      eventId: (body.eventId as string).trim(),
    },
  }
}

export function parseCareEvent(body: unknown): EventParse<CareEventValue> {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  const issues: EventInputIssue[] = []
  const add = (issue: EventInputIssue | null) => {
    if (issue !== null) issues.push(issue)
  }

  for (const key of Object.keys(body)) {
    if (!CARE_FIELDS.has(key)) issues.push("unknown-field")
  }

  if (!CARE_ACTIONS.includes(body.action as CareAction)) {
    issues.push("care-action-invalid")
  }

  add(eventIdIssue(body))

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    value: {
      action: body.action as CareAction,
      eventId: (body.eventId as string).trim(),
    },
  }
}
