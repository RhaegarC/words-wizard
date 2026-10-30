import type { Locale, ProgressStatus } from "./types"

/**
 * The wire shapes `/v1/me` returns (feature 23).
 *
 * They carry no numeric row ids and no `profileId`: the identity is the
 * verified token's `oid`, and feature 24 removes the client's numeric
 * compatibility seam. The Worker maps D1 rows into exactly these objects, so
 * the contract is one set of types rather than an inferred JSON blob.
 */

export interface ServerProfile {
  /** Mission 1 keeps `name` and `characterName` identical. */
  name: string
  characterName: string
  avatar: string
  currentTopicId: string | null
  xp: number
  createdAt: number
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
  locale: Locale
}

export interface ServerProgress {
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

export interface ServerMetric {
  name: string
  value: number
  updatedAt: number
}

/** One word introduced in one pack; a word may be introduced in several. */
export interface PackIntroduction {
  packId: string
  wordId: string
  introducedAt: number
}

/** `GET /v1/me`; `introductions` is `[]` until the first committed session. */
export interface MeResponse {
  profile: ServerProfile | null
  progress: ServerProgress[]
  metrics: ServerMetric[]
  introductions: PackIntroduction[]
}

export const CARE_ACTIONS = ["freeze", "quickWake"] as const

export type CareAction = (typeof CARE_ACTIONS)[number]

/**
 * `metric_events.name` for a care action. These are idempotency markers, not
 * counters: a freeze has no metric row of its own, and a quick wake's counter
 * is written only when its marker is new.
 */
export const CARE_EVENT_NAMES: Readonly<Record<CareAction, string>> = {
  freeze: "care.freeze",
  quickWake: "care.quickWake",
}

/** `POST /v1/me/profile`; `now` seeds `createdAt` and `lastPracticeAt`. */
export interface CreateProfileInput {
  characterName: string
  avatar: string
  currentTopicId: string | null
  locale: Locale
}

/** `PATCH /v1/me/profile`: only the fields a screen may change. */
export interface ProfilePatchInput {
  characterName?: string
  avatar?: string
  currentTopicId?: string | null
  locale?: Locale
}
