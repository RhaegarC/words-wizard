import { METRIC_NAME_VALUES } from "./metrics"
import type { MetricName } from "./metrics"
import type { SessionCommitPayload } from "./provider"
import type { ProgressStatus, SessionKind } from "./types"

/**
 * Why a session payload was refused. Validation runs before the transaction
 * opens, so a malformed payload cannot leave a partial commit behind.
 */
export type SessionPayloadIssue =
  | "profile-id-missing"
  | "word-id-missing"
  | "duplicate-word-id"
  | "review-in-past"
  | "strength-out-of-range"
  | "negative-xp"

/**
 * A payload is a session that has already ended, so every `nextReviewAt` it
 * carries must land at or after `now`. Returning all issues (rather than
 * throwing on the first) keeps a broken builder debuggable.
 */
export function validateSessionPayload(
  payload: SessionCommitPayload,
): SessionPayloadIssue[] {
  const issues: SessionPayloadIssue[] = []
  const add = (issue: SessionPayloadIssue) => {
    if (!issues.includes(issue)) {
      issues.push(issue)
    }
  }

  if (typeof payload.profileId !== "string" || payload.profileId.trim() === "") {
    add("profile-id-missing")
  }

  if (!isNonNegative(payload.xpEarned)) {
    add("negative-xp")
  }

  if (payload.profile.xp !== undefined && !isNonNegative(payload.profile.xp)) {
    add("negative-xp")
  }

  const seen = new Set<string>()

  for (const row of payload.progress) {
    const wordId = row.wordId.trim()

    if (wordId === "") {
      add("word-id-missing")
    } else if (seen.has(wordId)) {
      add("duplicate-word-id")
    } else {
      seen.add(wordId)
    }

    if (
      !Number.isFinite(row.strength) ||
      row.strength < 0 ||
      row.strength > 1
    ) {
      add("strength-out-of-range")
    }

    if (!Number.isFinite(row.nextReviewAt) || row.nextReviewAt < payload.now) {
      add("review-in-past")
    }
  }

  return issues
}

function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

/* ------------------------------------------------------------------------- *
 * Server shape (feature 23)
 *
 * The Worker receives a session that has already ended: the client sends the
 * absolute post-session profile, the words it touched, the pack introductions
 * it made, and the counter deltas. Identity is not part of the payload — it
 * comes from the verified token.
 * ------------------------------------------------------------------------- */

/** The client's commit validates this record before it is sent. */
export interface SessionRecordPayload {
  id: string
  kind: SessionKind
  localDate: string
  contentVersion: string
  xpEarned: number
  finishedAt: number
}

/** Absolute post-session profile values; the server stores them, never derives them. */
export interface ServerProfileCommit {
  xp: number
  lastPracticeAt: number
  lastWakeAt?: number | null
  frozenDays: number
  careTokens: number
  sessionsSinceLastToken: number
  completedSessions: number
  streakCount: number
  bestStreak: number
  lastStreakDate: string | null
  lastMonthlyReviewAt?: number | null
}

export interface ServerProgressCommit {
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

/** One word introduced in one pack; the same word may be introduced in many. */
export interface IntroductionCommit {
  packId: string
  wordId: string
  introducedAt: number
}

export interface ServerSessionCommitPayload {
  session: SessionRecordPayload
  now: number
  profile: ServerProfileCommit
  progress: readonly ServerProgressCommit[]
  introductions: readonly IntroductionCommit[]
  metrics?: Partial<Record<MetricName, number>>
}

/**
 * The server refuses before writing anything. Issues are reported as a set so
 * one broken payload shows every rule it broke; the route maps a clock issue
 * to `clock_out_of_range` and everything else to `validation_failed`.
 */
export type ServerSessionIssue =
  | "invalid-payload"
  | "session-id-invalid"
  | "session-kind-invalid"
  | "session-date-invalid"
  | "session-version-invalid"
  | "session-xp-invalid"
  | "clock-out-of-range"
  | "profile-value-invalid"
  | "progress-too-many"
  | "progress-word-missing"
  | "progress-duplicate-word"
  | "progress-value-invalid"
  | "strength-out-of-range"
  | "review-in-past"
  | "introduction-too-many"
  | "introduction-pair-invalid"
  | "introduction-duplicate"
  | "metric-name-invalid"
  | "metric-delta-invalid"

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_COMMIT_ROWS = 40
const MAX_SESSION_ID_LENGTH = 64
const MAX_SESSION_XP = 10_000
const SESSION_KINDS: readonly SessionKind[] = ["daily", "monthly"]
const PROGRESS_STATUSES: readonly ProgressStatus[] = [
  "new",
  "learning",
  "mastered",
]
const SIGNED_METRIC: MetricName = "monthlyReview.strengthDelta"

export function validateServerSessionPayload(
  payload: unknown,
  serverNow = Date.now(),
): ServerSessionIssue[] {
  const issues: ServerSessionIssue[] = []
  const add = (issue: ServerSessionIssue) => {
    if (!issues.includes(issue)) issues.push(issue)
  }

  if (!isRecord(payload)) {
    return ["invalid-payload"]
  }

  const session = isRecord(payload.session) ? payload.session : {}
  const profile = isRecord(payload.profile) ? payload.profile : {}
  const now = payload.now

  const sessionId = session.id
  if (
    typeof sessionId !== "string" ||
    sessionId.trim() === "" ||
    sessionId.length > MAX_SESSION_ID_LENGTH
  ) {
    add("session-id-invalid")
  }

  if (!SESSION_KINDS.includes(session.kind as SessionKind)) {
    add("session-kind-invalid")
  }

  if (!isLocalDate(session.localDate)) add("session-date-invalid")

  if (
    typeof session.contentVersion !== "string" ||
    session.contentVersion.trim() === ""
  ) {
    add("session-version-invalid")
  }

  if (
    !isNonNegativeInteger(session.xpEarned) ||
    session.xpEarned > MAX_SESSION_XP
  ) {
    add("session-xp-invalid")
  }

  // The client's clock is trusted only inside a day of the server's.
  if (!inClockWindow(now, serverNow)) add("clock-out-of-range")
  if (!inClockWindow(session.finishedAt, serverNow)) add("clock-out-of-range")

  for (const key of [
    "xp",
    "frozenDays",
    "careTokens",
    "sessionsSinceLastToken",
    "completedSessions",
    "streakCount",
    "bestStreak",
  ] as const) {
    if (!isNonNegativeNumber(profile[key])) add("profile-value-invalid")
  }

  if (!inClockWindow(profile.lastPracticeAt, serverNow)) {
    add("clock-out-of-range")
  }

  for (const key of ["lastWakeAt", "lastMonthlyReviewAt"] as const) {
    const value = profile[key]
    if (value === undefined || value === null) continue
    if (typeof value !== "number" || !Number.isFinite(value)) {
      add("profile-value-invalid")
    } else if (!inClockWindow(value, serverNow)) {
      add("clock-out-of-range")
    }
  }

  if (
    profile.lastStreakDate !== null &&
    profile.lastStreakDate !== undefined &&
    !isLocalDate(profile.lastStreakDate)
  ) {
    add("profile-value-invalid")
  }

  if (!Array.isArray(payload.progress)) {
    add("progress-value-invalid")
  } else {
    validateProgress(payload.progress, now, add)
  }

  if (!Array.isArray(payload.introductions)) {
    add("introduction-pair-invalid")
  } else {
    validateIntroductions(payload.introductions, serverNow, add)
  }

  if (payload.metrics !== undefined) {
    if (!isRecord(payload.metrics)) {
      add("metric-name-invalid")
    } else {
      for (const [name, delta] of Object.entries(payload.metrics)) {
        if (!METRIC_NAME_VALUES.includes(name as MetricName)) {
          add("metric-name-invalid")
          continue
        }

        if (typeof delta !== "number" || !Number.isFinite(delta)) {
          add("metric-delta-invalid")
          continue
        }

        if (name === SIGNED_METRIC) {
          if (delta < -1 || delta > 1) add("metric-delta-invalid")
        } else if (delta < 0) {
          add("metric-delta-invalid")
        }
      }
    }
  }

  return issues
}

function validateProgress(
  rows: readonly unknown[],
  now: unknown,
  add: (issue: ServerSessionIssue) => void,
): void {
  if (rows.length > MAX_COMMIT_ROWS) add("progress-too-many")

  const seen = new Set<string>()

  for (const row of rows) {
    if (!isRecord(row)) {
      add("progress-value-invalid")
      continue
    }

    const wordId = row.wordId

    if (typeof wordId !== "string" || wordId.trim() === "") {
      add("progress-word-missing")
    } else if (seen.has(wordId)) {
      add("progress-duplicate-word")
    } else {
      seen.add(wordId)
    }

    if (!PROGRESS_STATUSES.includes(row.status as ProgressStatus)) {
      add("progress-value-invalid")
    }

    if (
      typeof row.strength !== "number" ||
      !Number.isFinite(row.strength) ||
      row.strength < 0 ||
      row.strength > 1
    ) {
      add("strength-out-of-range")
    }

    for (const key of [
      "correctCount",
      "wrongCount",
      "firstSeenAt",
      "lastSeenAt",
      "nextReviewAt",
    ] as const) {
      if (!isNonNegativeInteger(row[key])) add("progress-value-invalid")
    }

    if (typeof row.masteryXpAwarded !== "boolean") {
      add("progress-value-invalid")
    }

    if (
      isNonNegativeInteger(row.nextReviewAt) &&
      typeof now === "number" &&
      row.nextReviewAt < now
    ) {
      add("review-in-past")
    }
  }
}

function validateIntroductions(
  rows: readonly unknown[],
  serverNow: number,
  add: (issue: ServerSessionIssue) => void,
): void {
  if (rows.length > MAX_COMMIT_ROWS) add("introduction-too-many")

  const seen = new Set<string>()

  for (const row of rows) {
    if (!isRecord(row)) {
      add("introduction-pair-invalid")
      continue
    }

    const packId = row.packId
    const wordId = row.wordId
    const idsValid =
      typeof packId === "string" &&
      packId.trim() !== "" &&
      typeof wordId === "string" &&
      wordId.trim() !== ""

    if (!idsValid) {
      add("introduction-pair-invalid")
    } else {
      const key = `${packId}\u0000${wordId}`
      if (seen.has(key)) add("introduction-duplicate")
      seen.add(key)
    }

    if (typeof row.introducedAt !== "number" || !Number.isFinite(row.introducedAt)) {
      add("introduction-pair-invalid")
    } else if (!inClockWindow(row.introducedAt, serverNow)) {
      add("clock-out-of-range")
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isInteger(value)
}

function inClockWindow(value: unknown, serverNow: number): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value - serverNow) <= DAY_MS
  )
}

/** A real calendar date in `YYYY-MM-DD`, not merely a matching string. */
export function isLocalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  )
}
