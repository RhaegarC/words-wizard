/**
 * Feature 35. The exam's pure rules: part construction, spelling comparison
 * and request validation. The Worker is authoritative; the client uses the
 * server's part boundaries and the same normalization for immediate feedback.
 */

/** A part must hold strictly fewer than 50 words. */
export const MAX_EXAM_PART_WORDS = 49
export const MAX_EXAM_ANSWERS = MAX_EXAM_PART_WORDS

const MAX_ID_LENGTH = 128
const MAX_ATTEMPT_ID_LENGTH = 128
const MAX_ANSWER_LENGTH = 200

export interface ExamPart {
  index: number
  wordIds: string[]
}

export interface ExamAnswer {
  wordId: string
  answer: string
}

export interface ExamSubmission {
  topicId: string
  partIndex: number
  attemptId: string
  contentVersion: string
  answers?: ExamAnswer[]
  missedWordId?: string
}

export interface ExamState {
  passedParts: number
  partCount: number
  contentVersion: string
  attempts: number
  lastAttemptAt: number | null
  completedAt: number | null
}

export interface ExamGate {
  introduced: number
  total: number
  unlocked: boolean
}

/** `GET /v1/me/exams/:topicId`; the server owns the part boundaries. */
export interface TopicExam {
  topicId: string
  /** The live content version the client must submit with. */
  contentVersion: string
  state: ExamState | null
  gate: ExamGate
  parts: ExamPart[]
  /** An unfinished exam whose content version no longer matches. */
  stale: boolean
}

/** A state row from `GET /v1/me/exams`. */
export interface TopicExamState {
  topicId: string
  passedParts: number
  partCount: number
  contentVersion: string
  attempts: number
  lastAttemptAt: number | null
  completedAt: number | null
}

export interface ExamResult {
  passed: boolean
  missedWordId: string | null
  correctSpelling: string | null
  state: ExamState
}

/**
 * Split ordered, distinct word ids into balanced parts of fewer than 50 words.
 * `ceil(n / 49)` parts, with the first `n % partCount` parts one word longer.
 */
export function buildExamParts(wordIds: readonly string[]): ExamPart[] {
  const unique = [...new Set(wordIds)]

  if (unique.length === 0) {
    return []
  }

  const partCount = Math.ceil(unique.length / MAX_EXAM_PART_WORDS)
  const base = Math.floor(unique.length / partCount)
  const extra = unique.length % partCount
  const parts: ExamPart[] = []
  let cursor = 0

  for (let index = 0; index < partCount; index += 1) {
    const size = base + (index < extra ? 1 : 0)

    parts.push({
      index,
      wordIds: unique.slice(cursor, cursor + size),
    })
    cursor += size
  }

  return parts
}

/** Trim, case-fold and collapse runs of whitespace; nothing else changes. */
export function normalizeSpelling(value: string): string {
  return value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ")
}

/**
 * The first word in part order whose answer does not match, or null. The
 * caller has already checked that the submitted ids equal the part's ids.
 */
export function firstMissedWord(
  partWordIds: readonly string[],
  answers: readonly ExamAnswer[],
  spellings: ReadonlyMap<string, string>,
): string | null {
  const byWord = new Map(answers.map((answer) => [answer.wordId, answer.answer]))

  for (const wordId of partWordIds) {
    const expected = spellings.get(wordId)
    const answer = byWord.get(wordId)

    if (
      expected === undefined ||
      answer === undefined ||
      normalizeSpelling(answer) !== normalizeSpelling(expected)
    ) {
      return wordId
    }
  }

  return null
}

export type ExamSubmissionParse =
  | { ok: true; value: ExamSubmission }
  | { ok: false; issues: string[] }

export function parseExamSubmission(value: unknown): ExamSubmissionParse {
  if (!isRecord(value)) {
    return { ok: false, issues: ["payload-invalid"] }
  }

  const issues: string[] = []
  const topicId = value.topicId
  const partIndex = value.partIndex
  const attemptId = value.attemptId
  const contentVersion = value.contentVersion
  const answers = value.answers
  const missedWordId = value.missedWordId

  if (!isNonEmpty(topicId, MAX_ID_LENGTH)) {
    issues.push("topic-invalid")
  }

  if (
    typeof partIndex !== "number" ||
    !Number.isInteger(partIndex) ||
    partIndex < 0
  ) {
    issues.push("part-index-invalid")
  }

  if (!isNonEmpty(attemptId, MAX_ATTEMPT_ID_LENGTH)) {
    issues.push("attempt-id-invalid")
  }

  if (!isNonEmpty(contentVersion, MAX_ID_LENGTH)) {
    issues.push("content-version-invalid")
  }

  const hasAnswers = answers !== undefined
  const hasMissed = missedWordId !== undefined

  if (hasAnswers === hasMissed) {
    issues.push("submission-invalid")
  }

  let parsedAnswers: ExamAnswer[] | undefined

  if (hasAnswers) {
    const parsed = parseAnswers(answers)

    if (parsed.issues.length > 0) {
      issues.push(...parsed.issues)
    } else {
      parsedAnswers = parsed.answers
    }
  }

  if (hasMissed && !isNonEmpty(missedWordId, MAX_ID_LENGTH)) {
    issues.push("missed-word-invalid")
  }

  if (issues.length > 0) {
    return { ok: false, issues: [...new Set(issues)] }
  }

  return {
    ok: true,
    value: {
      topicId: topicId as string,
      partIndex: partIndex as number,
      attemptId: attemptId as string,
      contentVersion: contentVersion as string,
      ...(parsedAnswers === undefined ? {} : { answers: parsedAnswers }),
      ...(hasMissed ? { missedWordId: missedWordId as string } : {}),
    },
  }
}

function parseAnswers(
  value: unknown,
): { answers: ExamAnswer[]; issues: string[] } {
  if (!Array.isArray(value) || value.length === 0) {
    return { answers: [], issues: ["answers-invalid"] }
  }

  if (value.length > MAX_EXAM_ANSWERS) {
    return { answers: [], issues: ["answers-too-many"] }
  }

  const answers: ExamAnswer[] = []
  const issues: string[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (!isRecord(entry)) {
      issues.push("answer-invalid")
      continue
    }

    const wordId = entry.wordId
    const answer = entry.answer

    if (!isNonEmpty(wordId, MAX_ID_LENGTH)) {
      issues.push("answer-word-invalid")
      continue
    }

    if (seen.has(wordId)) {
      issues.push("answer-duplicate")
    }
    seen.add(wordId)

    if (
      typeof answer !== "string" ||
      answer.trim() === "" ||
      answer.length > MAX_ANSWER_LENGTH
    ) {
      issues.push("answer-text-invalid")
      continue
    }

    answers.push({ wordId, answer })
  }

  return { answers, issues }
}

function isNonEmpty(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    value.length <= max
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
