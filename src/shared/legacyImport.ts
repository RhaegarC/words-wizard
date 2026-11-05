import { isLocalDate } from "./localDate"
import type { MeResponse } from "./me"
import type { ProgressStatus, Profile } from "./types"

/**
 * The Mission 1 → Mission 2 import contract (feature 27).
 *
 * Mission 1's IndexedDB rows are read on the device and sent as this payload;
 * the merge itself runs in SQL so two tabs cannot overwrite each other. The
 * rules below are the client's copy of the server's: a tie-break that the two
 * disagree about would make a replay change a row.
 */

/** The import carries a whole history, so it gets its own larger cap. */
export const MAX_IMPORT_BODY_BYTES = 256 * 1024
export const MAX_IMPORT_PROGRESS_ROWS = 512
export const MAX_IMPORT_METRIC_ROWS = 32
export const MAX_IMPORT_COUNTER = 1_000_000_000
/** 2100-01-01T00:00:00Z: far past any real session, and still a safe integer. */
export const MAX_IMPORT_TIMESTAMP = 4_102_444_800_000

export interface LegacyImportProfile {
  xp: number
  lastPracticeAt: number
  lastWakeAt: number | null
  frozenDays: number
  careTokens: number
  sessionsSinceLastToken: number
  completedSessions: number
  streakCount: number
  bestStreak: number
  lastStreakDate: string | null
  lastMonthlyReviewAt: number | null
}

export interface LegacyImportProgressRow {
  wordId: string
  status: ProgressStatus
  strength: number
  nextReviewAt: number
  correctCount: number
  wrongCount: number
  firstSeenAt: number
  lastSeenAt: number
  masteryXpAwarded: boolean
}

export interface LegacyImportMetricRow {
  name: string
  value: number
  updatedAt: number
}

export interface LegacyImportPayload {
  profile: LegacyImportProfile
  progress: LegacyImportProgressRow[]
  metrics: LegacyImportMetricRow[]
}

export interface LegacyImportSummary {
  progress: { imported: number; skipped: number }
  metrics: { imported: number; skipped: number }
  profileUpdated: boolean
}

/** `POST /v1/me/import`: the summary plus the full post-import `/v1/me`. */
export interface LegacyImportResponse extends LegacyImportSummary {
  me: MeResponse
}

/** What the client hands back to boot or to character creation. */
export interface LegacyImportOutcome extends LegacyImportSummary {
  profile: Profile
}

export type LegacyImportIssue =
  | "invalid-payload"
  | "invalid-profile"
  | "invalid-progress"
  | "invalid-metric"
  | "unknown-field"
  | "progress-too-many"
  | "metrics-too-many"
  | "duplicate-word-id"
  | "duplicate-metric-name"

export type ParsedLegacyImport =
  | { readonly ok: true; readonly value: LegacyImportPayload }
  | { readonly ok: false; readonly issues: readonly LegacyImportIssue[] }

const TOP_LEVEL_FIELDS = new Set(["profile", "progress", "metrics"])
const PROFILE_FIELDS = new Set([
  "xp",
  "lastPracticeAt",
  "lastWakeAt",
  "frozenDays",
  "careTokens",
  "sessionsSinceLastToken",
  "completedSessions",
  "streakCount",
  "bestStreak",
  "lastStreakDate",
  "lastMonthlyReviewAt",
])
const PROGRESS_FIELDS = new Set([
  "wordId",
  "status",
  "strength",
  "nextReviewAt",
  "correctCount",
  "wrongCount",
  "firstSeenAt",
  "lastSeenAt",
  "masteryXpAwarded",
])
const METRIC_FIELDS = new Set(["name", "value", "updatedAt"])
const STATUSES: readonly ProgressStatus[] = ["new", "learning", "mastered"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isCounter(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_IMPORT_COUNTER
  )
}

function isTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_IMPORT_TIMESTAMP
  )
}

function isOptionalTimestamp(value: unknown): value is number | null {
  return value === null || isTimestamp(value)
}

function hasUnknownField(
  body: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(body).some((key) => !allowed.has(key))
}

function profileIsValid(body: Record<string, unknown>): boolean {
  return (
    isCounter(body.xp) &&
    isTimestamp(body.lastPracticeAt) &&
    isOptionalTimestamp(body.lastWakeAt) &&
    isCounter(body.frozenDays) &&
    isCounter(body.careTokens) &&
    isCounter(body.sessionsSinceLastToken) &&
    isCounter(body.completedSessions) &&
    isCounter(body.streakCount) &&
    isCounter(body.bestStreak) &&
    (body.lastStreakDate === null || isLocalDate(body.lastStreakDate)) &&
    isOptionalTimestamp(body.lastMonthlyReviewAt)
  )
}

function progressIsValid(body: Record<string, unknown>): boolean {
  return (
    typeof body.wordId === "string" &&
    body.wordId.trim() !== "" &&
    STATUSES.includes(body.status as ProgressStatus) &&
    typeof body.strength === "number" &&
    Number.isFinite(body.strength) &&
    body.strength >= 0 &&
    body.strength <= 1 &&
    isTimestamp(body.nextReviewAt) &&
    isCounter(body.correctCount) &&
    isCounter(body.wrongCount) &&
    isTimestamp(body.firstSeenAt) &&
    isTimestamp(body.lastSeenAt) &&
    typeof body.masteryXpAwarded === "boolean"
  )
}

function metricIsValid(body: Record<string, unknown>): boolean {
  return (
    typeof body.name === "string" &&
    body.name.trim() !== "" &&
    typeof body.value === "number" &&
    Number.isFinite(body.value) &&
    isTimestamp(body.updatedAt)
  )
}

/**
 * Structural validation only. An unknown word id or metric name is *not* an
 * error: Mission 1 content may have been archived or renamed, so the merge
 * skips and counts those rows instead of refusing the whole history.
 */
export function parseLegacyImport(body: unknown): ParsedLegacyImport {
  if (!isRecord(body)) return { ok: false, issues: ["invalid-payload"] }

  const issues: LegacyImportIssue[] = []
  const add = (issue: LegacyImportIssue) => {
    if (!issues.includes(issue)) issues.push(issue)
  }

  if (hasUnknownField(body, TOP_LEVEL_FIELDS)) add("unknown-field")

  const profile = body.profile
  if (
    !isRecord(profile) ||
    hasUnknownField(profile, PROFILE_FIELDS) ||
    !profileIsValid(profile)
  ) {
    add(isRecord(profile) && hasUnknownField(profile, PROFILE_FIELDS)
      ? "unknown-field"
      : "invalid-profile")
  }

  const progress = body.progress
  if (!Array.isArray(progress)) {
    add("invalid-progress")
  } else {
    if (progress.length > MAX_IMPORT_PROGRESS_ROWS) add("progress-too-many")

    const seen = new Set<string>()
    for (const row of progress) {
      if (
        !isRecord(row) ||
        hasUnknownField(row, PROGRESS_FIELDS) ||
        !progressIsValid(row)
      ) {
        add("invalid-progress")
        continue
      }

      if (seen.has(row.wordId as string)) add("duplicate-word-id")
      seen.add(row.wordId as string)
    }
  }

  const metrics = body.metrics
  if (!Array.isArray(metrics)) {
    add("invalid-metric")
  } else {
    if (metrics.length > MAX_IMPORT_METRIC_ROWS) add("metrics-too-many")

    const seen = new Set<string>()
    for (const row of metrics) {
      if (
        !isRecord(row) ||
        hasUnknownField(row, METRIC_FIELDS) ||
        !metricIsValid(row)
      ) {
        add("invalid-metric")
        continue
      }

      if (seen.has(row.name as string)) add("duplicate-metric-name")
      seen.add(row.name as string)
    }
  }

  if (issues.length > 0) return { ok: false, issues }

  return { ok: true, value: body as unknown as LegacyImportPayload }
}

const RANK: Readonly<Record<ProgressStatus, number>> = {
  new: 0,
  learning: 1,
  mastered: 2,
}

export function progressRank(status: ProgressStatus): number {
  return RANK[status] ?? 0
}

/**
 * The "most advanced wins" comparison, exactly as the Worker's SQL applies it:
 * higher rank, then higher strength, then the earlier review. A full tie keeps
 * the cloud row, which is what makes an identical replay a no-op.
 */
export function incomingProgressWins(
  incoming: LegacyImportProgressRow,
  cloud: LegacyImportProgressRow,
): boolean {
  const incomingRank = progressRank(incoming.status)
  const cloudRank = progressRank(cloud.status)

  if (incomingRank !== cloudRank) return incomingRank > cloudRank
  if (incoming.strength !== cloud.strength) {
    return incoming.strength > cloud.strength
  }

  return incoming.nextReviewAt < cloud.nextReviewAt
}

/** The winning row, written whole, with mastery OR-ed in both directions. */
export function mergeProgressRows(
  incoming: LegacyImportProgressRow,
  cloud: LegacyImportProgressRow,
): LegacyImportProgressRow {
  const winner = incomingProgressWins(incoming, cloud) ? incoming : cloud

  return {
    ...winner,
    masteryXpAwarded: incoming.masteryXpAwarded || cloud.masteryXpAwarded,
  }
}

export function mergeCounter(cloud: number, incoming: number): number {
  return Math.max(cloud, incoming)
}

export function laterTimestamp(
  cloud: number | null,
  incoming: number | null,
): number | null {
  if (incoming === null) return cloud
  if (cloud === null) return incoming
  return Math.max(cloud, incoming)
}

export function laterLocalDate(
  cloud: string | null,
  incoming: string | null,
): string | null {
  if (incoming === null) return cloud
  if (cloud === null) return incoming
  return incoming > cloud ? incoming : cloud
}

/**
 * A legacy profile with no progress, no metrics, and no non-zero counter is a
 * character that was created and never used. Importing it would be noise; the
 * Settings card offers Discard instead.
 */
export function hasImportableData(payload: LegacyImportPayload): boolean {
  const profile = payload.profile

  return (
    payload.progress.length > 0 ||
    payload.metrics.length > 0 ||
    profile.xp > 0 ||
    profile.frozenDays > 0 ||
    profile.careTokens > 0 ||
    profile.sessionsSinceLastToken > 0 ||
    profile.completedSessions > 0 ||
    profile.streakCount > 0 ||
    profile.bestStreak > 0 ||
    profile.lastWakeAt !== null ||
    profile.lastMonthlyReviewAt !== null ||
    profile.lastStreakDate !== null
  )
}
