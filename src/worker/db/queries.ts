import { spendOnFreeze, spendOnQuickWake } from "../../shared/character"
import type {
  CareAction,
  PackIntroduction,
  ServerMetric,
  ServerProfile,
  ServerProgress,
} from "../../shared/me"
import { CARE_EVENT_NAMES } from "../../shared/me"
import { METRIC_NAMES, METRIC_NAME_VALUES } from "../../shared/metrics"
import type { MetricName } from "../../shared/metrics"
import type {
  IntroductionCommit,
  ServerSessionCommitPayload,
  ServerProfileCommit,
  ServerProgressCommit,
} from "../../shared/sessionPayload"
import type { ProgressStatus, Role } from "../../shared/types"

import type {
  LegacyImportPayload,
  LegacyImportResponse,
} from "../../shared/legacyImport"
import { isMetricName } from "../../shared/metrics"

import {
  CareUnavailableError,
  ProfileNotFoundError,
  UnknownPackWordError,
  UnknownWordError,
} from "../errors"

import type { D1Database, D1PreparedStatement } from "./d1"

/**
 * The user-data read and write paths (feature 23).
 *
 * Every function takes the identity the verified token supplied; none accepts
 * a user id from a body or path. Writes that must be all-or-nothing go through
 * one `db.batch()`, and idempotency is a key plus a `changes() = 1` guard on
 * the statement immediately after the marker insert.
 */

export interface UserRow {
  oid: string
  created_at: number
  last_seen_at: number
  email: string | null
}

/** What the verified token says about the caller, never what a body says. */
export interface Identity {
  readonly email: string | null
  readonly role: Role
}

export interface ProfileRow {
  user_id: string
  character_name: string
  avatar: string
  current_topic_id: string | null
  xp: number
  created_at: number
  last_practice_at: number
  last_wake_at: number | null
  frozen_days: number
  care_tokens: number
  sessions_since_last_token: number
  completed_sessions: number
  streak_count: number
  best_streak: number
  last_streak_date: string | null
  last_monthly_review_at: number | null
  locale: string
  role: string
  user_avatar_key: string | null
}

export interface ProgressRow {
  user_id: string
  word_id: string
  status: string
  strength: number
  next_review_at: number
  correct_count: number
  wrong_count: number
  first_seen_at: number
  last_seen_at: number
  mastery_xp_awarded: number
}

export interface MetricRow {
  user_id: string
  name: string
  value: number
  updated_at: number
}

export interface IntroductionRow {
  user_id: string
  pack_id: string
  word_id: string
  introduced_at: number
}

/** `name` mirrors `characterName`; the server has no separate display name. */
export function toServerProfile(row: ProfileRow): ServerProfile {
  return {
    name: row.character_name,
    characterName: row.character_name,
    avatar: row.avatar,
    currentTopicId: row.current_topic_id,
    xp: row.xp,
    createdAt: row.created_at,
    lastPracticeAt: row.last_practice_at,
    lastWakeAt: row.last_wake_at,
    frozenDays: row.frozen_days,
    careTokens: row.care_tokens,
    sessionsSinceLastToken: row.sessions_since_last_token,
    completedSessions: row.completed_sessions,
    streakCount: row.streak_count,
    bestStreak: row.best_streak,
    lastStreakDate: row.last_streak_date,
    lastMonthlyReviewAt: row.last_monthly_review_at,
    locale: row.locale === "zh" ? "zh" : "en",
    role: toRole(row.role),
    userAvatarKey: row.user_avatar_key,
  }
}

/** The column is constrained; an unexpected value still degrades to `user`. */
function toRole(value: string): Role {
  return value === "admin" || value === "teacher" ? value : "user"
}

export function toServerProgress(row: ProgressRow): ServerProgress {
  return {
    wordId: row.word_id,
    status: row.status as ProgressStatus,
    strength: row.strength,
    nextReviewAt: row.next_review_at,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    masteryXpAwarded: row.mastery_xp_awarded === 1,
  }
}

export function toServerMetric(row: MetricRow): ServerMetric {
  return { name: row.name, value: row.value, updatedAt: row.updated_at }
}

export function toIntroduction(row: IntroductionRow): PackIntroduction {
  return {
    packId: row.pack_id,
    wordId: row.word_id,
    introducedAt: row.introduced_at,
  }
}

const UPSERT_USER = `INSERT INTO users (oid, created_at, last_seen_at)
VALUES (?, ?, ?)
ON CONFLICT(oid) DO UPDATE SET last_seen_at = excluded.last_seen_at`

/**
 * The token is authoritative for the role, and an absent email never erases a
 * stored one: `COALESCE` keeps the older address when the new token has none.
 */
const SYNC_IDENTITY = `INSERT INTO users (oid, created_at, last_seen_at, email)
VALUES (?, ?, ?, ?)
ON CONFLICT(oid) DO UPDATE SET
  last_seen_at = excluded.last_seen_at,
  email = COALESCE(excluded.email, users.email)`

/** No row means no profile yet, which is also the correct no-op. */
const SYNC_ROLE = `UPDATE profiles SET role = ?
WHERE user_id = ? AND role <> ?`

const INSERT_PROFILE = `INSERT OR IGNORE INTO profiles (
  user_id, character_name, avatar, current_topic_id, xp, created_at,
  last_practice_at, last_wake_at, frozen_days, care_tokens,
  sessions_since_last_token, completed_sessions, streak_count, best_streak,
  last_streak_date, last_monthly_review_at, locale, role
) VALUES (?, ?, ?, ?, 0, ?, ?, NULL, 0, 0, 0, 0, 0, 0, NULL, NULL, ?, ?)`

const SET_AVATAR_KEY = `UPDATE profiles SET user_avatar_key = ? WHERE user_id = ?`

const UPSERT_PROGRESS = `INSERT INTO progress (
  user_id, word_id, status, strength, next_review_at, correct_count,
  wrong_count, first_seen_at, last_seen_at, mastery_xp_awarded
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(user_id, word_id) DO UPDATE SET
  status = excluded.status,
  strength = excluded.strength,
  next_review_at = excluded.next_review_at,
  correct_count = excluded.correct_count,
  wrong_count = excluded.wrong_count,
  first_seen_at = excluded.first_seen_at,
  last_seen_at = excluded.last_seen_at,
  mastery_xp_awarded = excluded.mastery_xp_awarded`

const INSERT_INTRODUCTION = `INSERT OR IGNORE INTO pack_introductions
  (user_id, pack_id, word_id, introduced_at) VALUES (?, ?, ?, ?)`

const ENSURE_METRIC = `INSERT OR IGNORE INTO metrics (user_id, name, value, updated_at)
VALUES (?, ?, 0, ?)`

/**
 * The defensive row is inserted *before* the marker so that the guard below
 * reads the marker's change count, not the row's.
 */
const INSERT_SESSION_METRIC = `INSERT OR IGNORE INTO session_metrics
  (user_id, session_id, name, delta) VALUES (?, ?, ?, ?)`

const ADD_METRIC_DELTA = `UPDATE metrics
SET value = value + ?, updated_at = ?
WHERE user_id = ? AND name = ? AND changes() = 1`

const INSERT_EVENT = `INSERT OR IGNORE INTO metric_events
  (user_id, event_id, name, delta, created_at) VALUES (?, ?, ?, ?, ?)`

const ADD_EVENT_DELTA = `UPDATE metrics
SET value = value + ?, updated_at = ?
WHERE user_id = ? AND name = ? AND changes() = 1`

const UPDATE_CARE_PROFILE = `UPDATE profiles
SET care_tokens = ?, sessions_since_last_token = ?, last_wake_at = ?,
    frozen_days = ?, streak_count = ?, best_streak = ?, last_streak_date = ?
WHERE user_id = ? AND changes() = 1`

/**
 * Every authenticated request records the identity before reading its data.
 * The email and role come from the verified token; both syncs are conditional
 * so an unchanged identity costs one statement that matches no row.
 */
export async function ensureUser(
  db: D1Database,
  oid: string,
  identity: Identity,
  now: number,
): Promise<void> {
  await db.batch([
    db.prepare(SYNC_IDENTITY).bind(oid, now, now, identity.email),
    db.prepare(SYNC_ROLE).bind(identity.role, oid, identity.role),
  ])
}

export async function readProfile(
  db: D1Database,
  oid: string,
): Promise<ProfileRow | null> {
  return db
    .prepare(
      `SELECT user_id, character_name, avatar, current_topic_id, xp, created_at,
              last_practice_at, last_wake_at, frozen_days, care_tokens,
              sessions_since_last_token, completed_sessions, streak_count,
              best_streak, last_streak_date, last_monthly_review_at, locale,
              role, user_avatar_key
         FROM profiles WHERE user_id = ?`,
    )
    .bind(oid)
    .first<ProfileRow>()
}

export async function readUser(
  db: D1Database,
  oid: string,
): Promise<UserRow | null> {
  return db
    .prepare(
      "SELECT oid, created_at, last_seen_at, email FROM users WHERE oid = ?",
    )
    .bind(oid)
    .first<UserRow>()
}

export async function readMe(db: D1Database, oid: string) {
  const [user, profile, progress, metrics, introductions] = await Promise.all([
    readUser(db, oid),
    readProfile(db, oid),
    db
      .prepare(
        `SELECT user_id, word_id, status, strength, next_review_at,
                correct_count, wrong_count, first_seen_at, last_seen_at,
                mastery_xp_awarded
           FROM progress WHERE user_id = ? ORDER BY word_id`,
      )
      .bind(oid)
      .all<ProgressRow>(),
    db
      .prepare(
        `SELECT user_id, name, value, updated_at FROM metrics
          WHERE user_id = ? ORDER BY name`,
      )
      .bind(oid)
      .all<MetricRow>(),
    db
      .prepare(
        `SELECT user_id, pack_id, word_id, introduced_at FROM pack_introductions
          WHERE user_id = ? ORDER BY pack_id, word_id`,
      )
      .bind(oid)
      .all<IntroductionRow>(),
  ])

  return {
    email: user?.email ?? null,
    profile: profile === null ? null : toServerProfile(profile),
    progress: progress.results.map(toServerProgress),
    metrics: metrics.results.map(toServerMetric),
    introductions: introductions.results.map(toIntroduction),
  }
}

export async function avatarExists(
  db: D1Database,
  avatarId: string,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS present FROM avatars WHERE id = ?")
    .bind(avatarId)
    .first<{ present: number }>()

  return row !== null
}

export async function topicExists(
  db: D1Database,
  topicId: string,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS present FROM topics WHERE id = ?")
    .bind(topicId)
    .first<{ present: number }>()

  return row !== null
}

export interface CreateProfileResult {
  readonly created: boolean
  readonly profile: ServerProfile
}

/**
 * Idempotent: the `(user_id)` key means a double-tap inserts one row. The
 * metric rows are seeded only for a new profile, and `OR IGNORE` keeps the
 * seeding harmless if two creations race.
 */
export async function createProfile(
  db: D1Database,
  oid: string,
  input: {
    characterName: string
    avatar: string
    currentTopicId: string | null
    locale: string
    role: Role
  },
  now: number,
): Promise<CreateProfileResult> {
  const result = await db
    .prepare(INSERT_PROFILE)
    .bind(
      oid,
      input.characterName,
      input.avatar,
      input.currentTopicId,
      now,
      now,
      input.locale,
      input.role,
    )
    .run()

  const created = (result.meta?.changes ?? 0) === 1

  if (created) {
    await db.batch(
      METRIC_NAME_VALUES.map((name) =>
        db.prepare(ENSURE_METRIC).bind(oid, name, now),
      ),
    )
  }

  const row = await readProfile(db, oid)
  if (row === null) throw new ProfileNotFoundError()
  return { created, profile: toServerProfile(row) }
}

export async function patchProfile(
  db: D1Database,
  oid: string,
  patch: {
    characterName?: string
    avatar?: string
    currentTopicId?: string | null
    locale?: string
  },
): Promise<ServerProfile | null> {
  const assignments: string[] = []
  const values: unknown[] = []

  if (patch.characterName !== undefined) {
    assignments.push("character_name = ?")
    values.push(patch.characterName)
  }
  if (patch.avatar !== undefined) {
    assignments.push("avatar = ?")
    values.push(patch.avatar)
  }
  if (patch.currentTopicId !== undefined) {
    assignments.push("current_topic_id = ?")
    values.push(patch.currentTopicId)
  }
  if (patch.locale !== undefined) {
    assignments.push("locale = ?")
    values.push(patch.locale)
  }

  if (assignments.length === 0) return readProfile(db, oid).then(nullable)

  const result = await db
    .prepare(`UPDATE profiles SET ${assignments.join(", ")} WHERE user_id = ?`)
    .bind(...values, oid)
    .run()

  if ((result.meta?.changes ?? 0) === 0) return null
  const row = await readProfile(db, oid)
  return row === null ? null : toServerProfile(row)
}

function nullable(row: ProfileRow | null): ServerProfile | null {
  return row === null ? null : toServerProfile(row)
}

/** False when the identity has no profile row to point at the object. */
export async function setUserAvatar(
  db: D1Database,
  oid: string,
  key: string,
): Promise<boolean> {
  const result = await db.prepare(SET_AVATAR_KEY).bind(key, oid).run()
  return (result.meta?.changes ?? 0) > 0
}

/** Idempotent: clearing an already-empty key still answers true. */
export async function clearUserAvatar(
  db: D1Database,
  oid: string,
): Promise<boolean> {
  const result = await db.prepare(SET_AVATAR_KEY).bind(null, oid).run()
  return (result.meta?.changes ?? 0) > 0
}

/** Any progress word id absent from `words`, or empty when every id exists. */
async function missingWords(
  db: D1Database,
  wordIds: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(wordIds)]
  if (unique.length === 0) return []

  const placeholders = unique.map(() => "?").join(", ")
  const rows = await db
    .prepare(`SELECT id FROM words WHERE id IN (${placeholders})`)
    .bind(...unique)
    .all<{ id: string }>()
  const found = new Set(rows.results.map((row) => row.id))

  return unique.filter((id) => !found.has(id))
}

/** Any `(packId, wordId)` absent from `pack_words`, or empty when all exist. */
async function missingPairs(
  db: D1Database,
  introductions: readonly IntroductionCommit[],
): Promise<IntroductionCommit[]> {
  if (introductions.length === 0) return []

  const packIds = [...new Set(introductions.map((row) => row.packId))]
  const wordIds = [...new Set(introductions.map((row) => row.wordId))]
  const rows = await db
    .prepare(
      `SELECT pack_id, word_id FROM pack_words
        WHERE pack_id IN (${packIds.map(() => "?").join(", ")})
          AND word_id IN (${wordIds.map(() => "?").join(", ")})`,
    )
    .bind(...packIds, ...wordIds)
    .all<{ pack_id: string; word_id: string }>()
  const found = new Set(
    rows.results.map((row) => `${row.pack_id}\u0000${row.word_id}`),
  )

  return introductions.filter(
    (row) => !found.has(`${row.packId}\u0000${row.wordId}`),
  )
}

function progressStatement(
  db: D1Database,
  oid: string,
  row: ServerProgressCommit,
): D1PreparedStatement {
  return db
    .prepare(UPSERT_PROGRESS)
    .bind(
      oid,
      row.wordId,
      row.status,
      row.strength,
      row.nextReviewAt,
      row.correctCount,
      row.wrongCount,
      row.firstSeenAt,
      row.lastSeenAt,
      row.masteryXpAwarded ? 1 : 0,
    )
}

const UPDATE_PROFILE_COMMIT = `UPDATE profiles SET
  xp = ?, last_practice_at = ?, last_wake_at = ?, frozen_days = ?,
  care_tokens = ?, sessions_since_last_token = ?, completed_sessions = ?,
  streak_count = ?, best_streak = ?, last_streak_date = ?,
  last_monthly_review_at = ?
WHERE user_id = ?`

function profileCommitStatement(
  db: D1Database,
  oid: string,
  profile: ServerProfileCommit,
): D1PreparedStatement {
  return db
    .prepare(UPDATE_PROFILE_COMMIT)
    .bind(
      profile.xp,
      profile.lastPracticeAt,
      profile.lastWakeAt ?? null,
      profile.frozenDays,
      profile.careTokens,
      profile.sessionsSinceLastToken,
      profile.completedSessions,
      profile.streakCount,
      profile.bestStreak,
      profile.lastStreakDate ?? null,
      profile.lastMonthlyReviewAt ?? null,
      oid,
    )
}

/**
 * One transaction, in the documented order. Steps 3–5 are absolute values, so
 * replaying the identical payload is harmless; the counter update is gated on
 * the `session_metrics` marker insert, so XP and session counts are added only
 * on the first commit of a session.
 */
export async function commitSession(
  db: D1Database,
  oid: string,
  payload: ServerSessionCommitPayload,
  now: number,
) {
  const profile = await readProfile(db, oid)
  if (profile === null) throw new ProfileNotFoundError()

  if (
    (
      await missingWords(
        db,
        payload.progress.map((row) => row.wordId),
      )
    ).length > 0
  ) {
    throw new UnknownWordError()
  }
  if ((await missingPairs(db, payload.introductions)).length > 0) {
    throw new UnknownPackWordError()
  }

  const statements: D1PreparedStatement[] = [
    db.prepare(UPSERT_USER).bind(oid, now, now),
    db
      .prepare(
        `INSERT OR IGNORE INTO sessions
           (id, user_id, kind, local_date, content_version, xp_earned, finished_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        payload.session.id,
        oid,
        payload.session.kind,
        payload.session.localDate,
        payload.session.contentVersion,
        payload.session.xpEarned,
        payload.session.finishedAt,
        now,
      ),
    profileCommitStatement(db, oid, payload.profile),
  ]

  for (const row of payload.progress) {
    statements.push(progressStatement(db, oid, row))
  }

  for (const row of payload.introductions) {
    statements.push(
      db
        .prepare(INSERT_INTRODUCTION)
        .bind(oid, row.packId, row.wordId, row.introducedAt),
    )
  }

  for (const [name, delta] of Object.entries(payload.metrics ?? {})) {
    statements.push(db.prepare(ENSURE_METRIC).bind(oid, name, now))
    statements.push(
      db
        .prepare(INSERT_SESSION_METRIC)
        .bind(oid, payload.session.id, name, delta),
    )
    statements.push(
      db.prepare(ADD_METRIC_DELTA).bind(delta, now, oid, name),
    )
  }

  await db.batch(statements)
  return readMe(db, oid)
}

export interface MetricEventInput {
  readonly name: MetricName
  readonly delta: number
  readonly eventId: string
}

/** The `metric_events` row is the marker; the delta applies once per event. */
export async function writeMetric(
  db: D1Database,
  oid: string,
  event: MetricEventInput,
  now: number,
): Promise<ServerMetric> {
  await db.batch([
    db.prepare(UPSERT_USER).bind(oid, now, now),
    db.prepare(ENSURE_METRIC).bind(oid, event.name, now),
    db
      .prepare(INSERT_EVENT)
      .bind(oid, event.eventId, event.name, event.delta, now),
    db.prepare(ADD_EVENT_DELTA).bind(event.delta, now, oid, event.name),
  ])

  const row = await db
    .prepare(
      "SELECT user_id, name, value, updated_at FROM metrics WHERE user_id = ? AND name = ?",
    )
    .bind(oid, event.name)
    .first<MetricRow>()

  if (row === null) throw new Error(`metric ${event.name} was not written`)
  return toServerMetric(row)
}

/**
 * The one server-applied domain rule: the same pure functions the client uses.
 * The marker insert comes first, the profile update is gated on it, and the
 * quick-wake counter is gated on the profile update — so a replay by `eventId`
 * neither spends a second token nor counts the revival twice.
 */
export async function applyCare(
  db: D1Database,
  oid: string,
  action: CareAction,
  eventId: string,
  now: number,
): Promise<ServerProfile> {
  const row = await readProfile(db, oid)
  if (row === null) throw new ProfileNotFoundError()

  // A replay returns the state the first call left. Checking the marker first
  // matters for care: after a successful spend the token is gone, and the
  // affordability rule would otherwise reject the replay with 409.
  const seen = await db
    .prepare(
      "SELECT 1 AS present FROM metric_events WHERE user_id = ? AND event_id = ?",
    )
    .bind(oid, eventId)
    .first<{ present: number }>()

  if (seen !== null) return toServerProfile(row)

  // The pure rules take the shared `Profile`; the Worker's row has no id
  // column because the user id is the key. Supply the oid for the type only.
  const profile = { ...toServerProfile(row), id: oid }
  const outcome =
    action === "freeze"
      ? spendOnFreeze(profile, now)
      : spendOnQuickWake(profile, now)

  if (!outcome.spent) throw new CareUnavailableError(outcome.reason)

  const statements: D1PreparedStatement[] = [
    db.prepare(UPSERT_USER).bind(oid, now, now),
  ]

  if (action === "quickWake") {
    // Before the marker, so the marker's changes() guard reaches the profile.
    statements.push(
      db.prepare(ENSURE_METRIC).bind(oid, METRIC_NAMES.revivalQuickWake, now),
    )
  }

  statements.push(
    db
      .prepare(INSERT_EVENT)
      .bind(oid, eventId, CARE_EVENT_NAMES[action], 1, now),
    db
      .prepare(UPDATE_CARE_PROFILE)
      .bind(
        outcome.profile.careTokens,
        outcome.profile.sessionsSinceLastToken,
        outcome.profile.lastWakeAt,
        outcome.profile.frozenDays,
        outcome.profile.streakCount,
        outcome.profile.bestStreak,
        outcome.profile.lastStreakDate,
        oid,
      ),
  )

  if (action === "quickWake") {
    statements.push(
      db
        .prepare(ADD_EVENT_DELTA)
        .bind(1, now, oid, METRIC_NAMES.revivalQuickWake),
    )
  }

  await db.batch(statements)

  const updated = await readProfile(db, oid)
  if (updated === null) throw new ProfileNotFoundError()
  return toServerProfile(updated)
}

/**
 * D1 caps bound parameters per statement at 100, and a full Mission 1 history
 * can exceed that. Word-id lookups and progress writes are chunked below it.
 */
const IMPORT_CHUNK = 90

/**
 * The "most advanced wins" comparison (feature 27), in SQL so two tabs cannot
 * interleave a read-then-write. It mirrors `incomingProgressWins` in
 * `shared/legacyImport.ts`.
 */
const IMPORT_INCOMING_RANK =
  "(CASE excluded.status WHEN 'mastered' THEN 2 WHEN 'learning' THEN 1 ELSE 0 END)"
const IMPORT_CLOUD_RANK =
  "(CASE progress.status WHEN 'mastered' THEN 2 WHEN 'learning' THEN 1 ELSE 0 END)"
const IMPORT_INCOMING_WINS = `(
  ${IMPORT_INCOMING_RANK} > ${IMPORT_CLOUD_RANK}
  OR (${IMPORT_INCOMING_RANK} = ${IMPORT_CLOUD_RANK}
      AND excluded.strength > progress.strength)
  OR (${IMPORT_INCOMING_RANK} = ${IMPORT_CLOUD_RANK}
      AND excluded.strength = progress.strength
      AND excluded.next_review_at < progress.next_review_at)
)`

/** The winning row is written whole; mastery is OR-ed in both directions. */
const UPSERT_IMPORT_PROGRESS = `INSERT INTO progress (
  user_id, word_id, status, strength, next_review_at, correct_count,
  wrong_count, first_seen_at, last_seen_at, mastery_xp_awarded
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(user_id, word_id) DO UPDATE SET
  status = CASE WHEN ${IMPORT_INCOMING_WINS} THEN excluded.status ELSE progress.status END,
  strength = CASE WHEN ${IMPORT_INCOMING_WINS} THEN excluded.strength ELSE progress.strength END,
  next_review_at = CASE WHEN ${IMPORT_INCOMING_WINS} THEN excluded.next_review_at ELSE progress.next_review_at END,
  correct_count = CASE WHEN ${IMPORT_INCOMING_WINS} THEN excluded.correct_count ELSE progress.correct_count END,
  wrong_count = CASE WHEN ${IMPORT_INCOMING_WINS} THEN excluded.wrong_count ELSE progress.wrong_count END,
  first_seen_at = CASE WHEN ${IMPORT_INCOMING_WINS} THEN excluded.first_seen_at ELSE progress.first_seen_at END,
  last_seen_at = CASE WHEN ${IMPORT_INCOMING_WINS} THEN excluded.last_seen_at ELSE progress.last_seen_at END,
  mastery_xp_awarded = CASE
    WHEN excluded.mastery_xp_awarded = 1 OR progress.mastery_xp_awarded = 1 THEN 1
    ELSE 0 END`

/**
 * Larger/later for every counter and timestamp, and no identity field is in
 * the statement. A `NULL` incoming timestamp keeps the cloud value.
 */
const UPDATE_IMPORT_PROFILE = `UPDATE profiles SET
  xp = MAX(xp, ?),
  last_practice_at = MAX(last_practice_at, ?),
  last_wake_at = CASE
    WHEN ? IS NULL THEN last_wake_at
    WHEN last_wake_at IS NULL THEN ?
    ELSE MAX(last_wake_at, ?) END,
  frozen_days = MAX(frozen_days, ?),
  care_tokens = MAX(care_tokens, ?),
  sessions_since_last_token = MAX(sessions_since_last_token, ?),
  completed_sessions = MAX(completed_sessions, ?),
  streak_count = MAX(streak_count, ?),
  best_streak = MAX(best_streak, ?),
  last_streak_date = CASE
    WHEN ? IS NULL THEN last_streak_date
    WHEN last_streak_date IS NULL THEN ?
    ELSE MAX(last_streak_date, ?) END,
  last_monthly_review_at = CASE
    WHEN ? IS NULL THEN last_monthly_review_at
    WHEN last_monthly_review_at IS NULL THEN ?
    ELSE MAX(last_monthly_review_at, ?) END
WHERE user_id = ?`

/** Idempotent even for the signed monthly-review delta. */
const UPSERT_IMPORT_METRIC = `INSERT INTO metrics (user_id, name, value, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(user_id, name) DO UPDATE SET
  value = MAX(metrics.value, excluded.value),
  updated_at = CASE
    WHEN excluded.value > metrics.value
      THEN MAX(metrics.updated_at, excluded.updated_at)
    ELSE metrics.updated_at END`

/** Word ids present in D1, read in chunks under the bound-parameter cap. */
async function knownWordIds(
  db: D1Database,
  wordIds: readonly string[],
): Promise<Set<string>> {
  const unique = [...new Set(wordIds)]
  const found = new Set<string>()

  for (let start = 0; start < unique.length; start += IMPORT_CHUNK) {
    const chunk = unique.slice(start, start + IMPORT_CHUNK)
    const rows = await db
      .prepare(`SELECT id FROM words WHERE id IN (${chunk.map(() => "?").join(", ")})`)
      .bind(...chunk)
      .all<{ id: string }>()

    for (const row of rows.results) found.add(row.id)
  }

  return found
}

function importProgressStatement(
  db: D1Database,
  oid: string,
  row: LegacyImportPayload["progress"][number],
): D1PreparedStatement {
  return db
    .prepare(UPSERT_IMPORT_PROGRESS)
    .bind(
      oid,
      row.wordId,
      row.status,
      row.strength,
      row.nextReviewAt,
      row.correctCount,
      row.wrongCount,
      row.firstSeenAt,
      row.lastSeenAt,
      row.masteryXpAwarded ? 1 : 0,
    )
}

/**
 * Merge a Mission 1 payload into the identity's rows (feature 27).
 *
 * Profile and metrics are one atomic batch. Progress is not: a full history can
 * exceed D1's batch ceiling, so it is written in chunks of idempotent merges.
 * A failed run therefore leaves a valid prefix, and the retry converges.
 */
export async function importLegacyData(
  db: D1Database,
  oid: string,
  payload: LegacyImportPayload,
): Promise<LegacyImportResponse> {
  if ((await readProfile(db, oid)) === null) throw new ProfileNotFoundError()

  // An id missing from D1 is skipped and counted, not failed: content may have
  // been archived or renamed since Mission 1.
  const known = await knownWordIds(
    db,
    payload.progress.map((row) => row.wordId),
  )
  const progressRows = payload.progress.filter((row) => known.has(row.wordId))
  const metricRows = payload.metrics.filter((row) => isMetricName(row.name))

  const profile = payload.profile
  const statements: D1PreparedStatement[] = [
    db
      .prepare(UPDATE_IMPORT_PROFILE)
      .bind(
        profile.xp,
        profile.lastPracticeAt,
        profile.lastWakeAt,
        profile.lastWakeAt,
        profile.lastWakeAt,
        profile.frozenDays,
        profile.careTokens,
        profile.sessionsSinceLastToken,
        profile.completedSessions,
        profile.streakCount,
        profile.bestStreak,
        profile.lastStreakDate,
        profile.lastStreakDate,
        profile.lastStreakDate,
        profile.lastMonthlyReviewAt,
        profile.lastMonthlyReviewAt,
        profile.lastMonthlyReviewAt,
        oid,
      ),
  ]

  for (const row of metricRows) {
    statements.push(
      db
        .prepare(UPSERT_IMPORT_METRIC)
        .bind(oid, row.name, row.value, row.updatedAt),
    )
  }

  // At most 1 + 32 statements, well inside the batch ceiling.
  await db.batch(statements)

  for (let start = 0; start < progressRows.length; start += IMPORT_CHUNK) {
    const chunk = progressRows.slice(start, start + IMPORT_CHUNK)
    await db.batch(
      chunk.map((row) => importProgressStatement(db, oid, row)),
    )
  }

  return {
    progress: {
      imported: progressRows.length,
      skipped: payload.progress.length - progressRows.length,
    },
    metrics: {
      imported: metricRows.length,
      skipped: payload.metrics.length - metricRows.length,
    },
    profileUpdated: true,
    me: await readMe(db, oid),
  }
}
