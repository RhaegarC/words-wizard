import {
  buildExamParts,
  firstMissedWord,
  type ExamResult,
  type ExamState,
  type ExamSubmission,
  type TopicExam,
  type TopicExamState,
} from "../../shared/exam"
import { METRIC_NAMES } from "../../shared/metrics"
import { readContentVersion } from "../content"
import {
  ConflictError,
  ExamLockedError,
  ExamStaleError,
  ValidationFailedError,
} from "../errors"

import type { D1Database, D1PreparedStatement } from "./d1"

/**
 * Feature 35. Exam reads and the one atomic submission write.
 *
 * The Worker is authoritative for the gate, the part boundaries and the
 * spelling comparison. Typed answers are compared in memory and never written;
 * `exam_attempts` stores only the outcome and the missed word id.
 */

interface ExamProgressRow {
  user_id: string
  topic_id: string
  passed_parts: number
  part_count: number
  content_version: string
  attempts: number
  last_attempt_at: number | null
  completed_at: number | null
  updated_at: number
}

interface ExamAttemptRow {
  user_id: string
  attempt_id: string
  topic_id: string
  part_index: number
  passed: number
  missed_word_id: string | null
  at: number
}

interface TopicWordRow {
  pack_order: number
  pack_id: string
  position: number
  word_id: string
}

interface WordTextRow {
  id: string
  text: string
}

const ENSURE_METRIC = `INSERT OR IGNORE INTO metrics (user_id, name, value, updated_at)
VALUES (?, ?, 0, ?)`

const INSERT_METRIC_EVENT = `INSERT OR IGNORE INTO metric_events
  (user_id, event_id, name, delta, created_at) VALUES (?, ?, ?, ?, ?)`

const ADD_METRIC_DELTA = `UPDATE metrics
SET value = value + ?, updated_at = ?
WHERE user_id = ? AND name = ? AND changes() = 1`

const UPSERT_PROGRESS = `INSERT INTO topic_exam_progress (
  user_id, topic_id, passed_parts, part_count, content_version, attempts,
  last_attempt_at, completed_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(user_id, topic_id) DO UPDATE SET
  passed_parts = excluded.passed_parts,
  part_count = excluded.part_count,
  content_version = excluded.content_version,
  attempts = excluded.attempts,
  last_attempt_at = excluded.last_attempt_at,
  completed_at = COALESCE(topic_exam_progress.completed_at, excluded.completed_at),
  updated_at = excluded.updated_at`

export async function readExamStates(
  db: D1Database,
  oid: string,
): Promise<TopicExamState[]> {
  const rows = await db
    .prepare(
      `SELECT user_id, topic_id, passed_parts, part_count, content_version,
              attempts, last_attempt_at, completed_at, updated_at
         FROM topic_exam_progress WHERE user_id = ? ORDER BY topic_id`,
    )
    .bind(oid)
    .all<ExamProgressRow>()

  return rows.results.map((row) => ({
    topicId: row.topic_id,
    passedParts: row.passed_parts,
    partCount: row.part_count,
    contentVersion: row.content_version,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at,
    completedAt: row.completed_at,
  }))
}

export async function readTopicExam(
  db: D1Database,
  oid: string,
  topicId: string,
): Promise<TopicExam> {
  const contentVersion = await readContentVersion(db)
  const ordered = await orderedTopicWordIds(db, topicId)
  const introduced = await introducedWordIds(db, oid, topicId)
  const gate = {
    introduced: ordered.filter((wordId) => introduced.has(wordId)).length,
    total: ordered.length,
    unlocked: ordered.length > 0 && ordered.every((wordId) => introduced.has(wordId)),
  }
  const state = await readProgress(db, oid, topicId)

  return {
    topicId,
    contentVersion,
    state,
    gate,
    parts: buildExamParts(ordered),
    stale:
      state !== null &&
      state.contentVersion !== contentVersion &&
      state.completedAt === null,
  }
}

export async function submitExam(
  db: D1Database,
  oid: string,
  submission: ExamSubmission,
  now: number,
): Promise<ExamResult> {
  const exam = await readTopicExam(db, oid, submission.topicId)
  const currentVersion = await readContentVersion(db)

  if (!exam.gate.unlocked) {
    throw new ExamLockedError()
  }

  const replay = await readAttempt(db, oid, submission.attemptId)

  if (replay !== null) {
    if (
      replay.topic_id !== submission.topicId ||
      replay.part_index !== submission.partIndex
    ) {
      throw new ConflictError("That attempt id belongs to another exam part.")
    }

    const missedWordId = replay.missed_word_id

    return {
      passed: replay.passed === 1,
      missedWordId,
      correctSpelling:
        missedWordId === null ? null : await readWordText(db, missedWordId),
      state:
        exam.state ??
        emptyState(exam.parts.length, currentVersion, now),
    }
  }

  if (exam.stale) {
    await resetUnfinishedExam(
      db,
      oid,
      submission.topicId,
      exam.parts.length,
      currentVersion,
      now,
    )

    throw new ExamStaleError()
  }

  if (submission.contentVersion !== currentVersion) {
    if (exam.state !== null && exam.state.completedAt === null) {
      await resetUnfinishedExam(
        db,
        oid,
        submission.topicId,
        exam.parts.length,
        currentVersion,
        now,
      )
    }

    throw new ExamStaleError()
  }

  const part = exam.parts[submission.partIndex]

  if (part === undefined) {
    throw new ValidationFailedError("Unknown exam part.")
  }

  const completed = exam.state?.completedAt != null
  const contentChanged =
    exam.state !== null && exam.state.contentVersion !== currentVersion
  const passedParts =
    completed && contentChanged ? 0 : (exam.state?.passedParts ?? 0)

  if (!completed && submission.partIndex !== passedParts) {
    throw new ExamLockedError("This part is not available yet.")
  }

  const answers = submission.answers
  let missedWordId: string | null = null

  if (submission.missedWordId !== undefined) {
    if (!part.wordIds.includes(submission.missedWordId)) {
      throw new ValidationFailedError("The missed word is not in this part.")
    }

    missedWordId = submission.missedWordId
  } else {
    const byWord = new Map(
      (answers ?? []).map((answer) => [answer.wordId, answer.answer]),
    )

    if (
      byWord.size !== part.wordIds.length ||
      part.wordIds.some((wordId) => !byWord.has(wordId))
    ) {
      throw new ValidationFailedError("The answers do not match this part.")
    }

    const spellings = await readSpellings(db, part.wordIds)
    missedWordId = firstMissedWord(part.wordIds, answers ?? [], spellings)
  }

  const passed = missedWordId === null
  const nextPassedParts = passed
    ? Math.max(passedParts, submission.partIndex + 1)
    : passedParts
  const completedNow =
    passed &&
    nextPassedParts >= exam.parts.length &&
    exam.state?.completedAt == null
  const completedAt =
    exam.state?.completedAt ??
    (passed && nextPassedParts >= exam.parts.length ? now : null)
  const state: ExamState = {
    passedParts: nextPassedParts,
    partCount: exam.parts.length,
    contentVersion: currentVersion,
    attempts: (exam.state?.attempts ?? 0) + 1,
    lastAttemptAt: now,
    completedAt,
  }

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO exam_attempts
           (user_id, attempt_id, topic_id, part_index, passed, missed_word_id, at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        oid,
        submission.attemptId,
        submission.topicId,
        submission.partIndex,
        passed ? 1 : 0,
        missedWordId,
        now,
      ),
    db
      .prepare(UPSERT_PROGRESS)
      .bind(
        oid,
        submission.topicId,
        state.passedParts,
        state.partCount,
        state.contentVersion,
        state.attempts,
        state.lastAttemptAt,
        state.completedAt,
        now,
      ),
  ]

  const metricName = passed
    ? METRIC_NAMES.examPartPassed
    : METRIC_NAMES.examPartFailed

  statements.push(
    ...metricStatements(
      db,
      oid,
      `${submission.attemptId}:outcome`,
      metricName,
      now,
    ),
  )

  if (completedNow) {
    statements.push(
      ...metricStatements(
        db,
        oid,
        `${submission.attemptId}:completed`,
        METRIC_NAMES.examTopicCompleted,
        now,
      ),
    )
  }

  await db.batch(statements)

  return {
    passed,
    missedWordId,
    correctSpelling:
      missedWordId === null ? null : await readWordText(db, missedWordId),
    state,
  }
}

async function readProgress(
  db: D1Database,
  oid: string,
  topicId: string,
): Promise<ExamState | null> {
  const row = await db
    .prepare(
      `SELECT user_id, topic_id, passed_parts, part_count, content_version,
              attempts, last_attempt_at, completed_at, updated_at
         FROM topic_exam_progress WHERE user_id = ? AND topic_id = ?`,
    )
    .bind(oid, topicId)
    .first<ExamProgressRow>()

  return row === null ? null : toExamState(row)
}

function toExamState(row: ExamProgressRow): ExamState {
  return {
    passedParts: row.passed_parts,
    partCount: row.part_count,
    contentVersion: row.content_version,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at,
    completedAt: row.completed_at,
  }
}

function emptyState(
  partCount: number,
  contentVersion: string,
  now: number,
): ExamState {
  return {
    passedParts: 0,
    partCount,
    contentVersion,
    attempts: 0,
    lastAttemptAt: now,
    completedAt: null,
  }
}

async function readAttempt(
  db: D1Database,
  oid: string,
  attemptId: string,
): Promise<ExamAttemptRow | null> {
  return db
    .prepare(
      `SELECT user_id, attempt_id, topic_id, part_index, passed, missed_word_id, at
         FROM exam_attempts WHERE user_id = ? AND attempt_id = ?`,
    )
    .bind(oid, attemptId)
    .first<ExamAttemptRow>()
}

/** The topic's distinct word ids in pack order, then position, then id. */
async function orderedTopicWordIds(
  db: D1Database,
  topicId: string,
): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT p.sort_order AS pack_order, p.id AS pack_id,
              pw.position AS position, w.id AS word_id
         FROM packs p
         JOIN pack_words pw ON pw.pack_id = p.id
         JOIN words w ON w.id = pw.word_id
        WHERE p.topic_id = ? AND p.archived_at IS NULL AND w.archived_at IS NULL
        ORDER BY p.sort_order ASC, p.id ASC, pw.position ASC, w.id ASC`,
    )
    .bind(topicId)
    .all<TopicWordRow>()

  const seen = new Set<string>()

  return rows.results
    .map((row) => row.word_id)
    .filter((wordId) => {
      if (seen.has(wordId)) return false
      seen.add(wordId)
      return true
    })
}

async function introducedWordIds(
  db: D1Database,
  oid: string,
  topicId: string,
): Promise<ReadonlySet<string>> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT pi.word_id
         FROM pack_introductions pi
         JOIN packs p ON p.id = pi.pack_id
        WHERE pi.user_id = ? AND p.topic_id = ? AND p.archived_at IS NULL`,
    )
    .bind(oid, topicId)
    .all<{ word_id: string }>()

  return new Set(rows.results.map((row) => row.word_id))
}

async function readSpellings(
  db: D1Database,
  wordIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (wordIds.length === 0) return new Map()

  const rows = await db
    .prepare(
      `SELECT id, text FROM words WHERE id IN (${wordIds.map(() => "?").join(", ")})`,
    )
    .bind(...wordIds)
    .all<WordTextRow>()

  return new Map(rows.results.map((row) => [row.id, row.text]))
}

async function readWordText(
  db: D1Database,
  wordId: string,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT text FROM words WHERE id = ?")
    .bind(wordId)
    .first<{ text: string }>()

  return row?.text ?? null
}

async function resetUnfinishedExam(
  db: D1Database,
  oid: string,
  topicId: string,
  partCount: number,
  contentVersion: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE topic_exam_progress
          SET passed_parts = 0, part_count = ?, content_version = ?, updated_at = ?
        WHERE user_id = ? AND topic_id = ?`,
    )
    .bind(partCount, contentVersion, now, oid, topicId)
    .run()
}

/**
 * One metric increment, guarded by the `metric_events` marker immediately
 * before the update. Replaying an attempt never reaches this code, but the
 * marker keeps the write idempotent under a retry that lost the response.
 */
function metricStatements(
  db: D1Database,
  oid: string,
  eventId: string,
  name: string,
  now: number,
): D1PreparedStatement[] {
  return [
    db.prepare(ENSURE_METRIC).bind(oid, name, now),
    db.prepare(INSERT_METRIC_EVENT).bind(oid, eventId, name, 1, now),
    db.prepare(ADD_METRIC_DELTA).bind(1, now, oid, name),
  ]
}
