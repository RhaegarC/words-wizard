import type { IntroductionWrite } from "./provider"
import type { Pack } from "./types"

/**
 * Feature 36. A topic's status is derived, never stored.
 *
 * `completedAt` on the topic exam is the only persisted fact. A live topic with
 * no introductions is None; one with an introduction in any of its live packs
 * is Learning. Completed wins over both and is sticky, so a retake, a demoted
 * word or content growth cannot clear it.
 */

export const TOPIC_STATUSES = ["none", "learning", "completed"] as const

export type TopicStatus = typeof TOPIC_STATUSES[number]

/** The part of an exam state that status derivation needs. */
export interface TopicStatusExam {
  topicId: string
  completedAt: number | null
}

export interface DeriveTopicStatusInput {
  topicId: string
  /** The live packs from the content bundle; archived packs are absent. */
  packs: readonly Pack[]
  /** Per-pack introduction rows from `/v1/me`. */
  introductions: readonly IntroductionWrite[]
  /** Per-topic exam rows from `/v1/me/exams`. */
  exams: readonly TopicStatusExam[]
}

export function deriveTopicStatus(input: DeriveTopicStatusInput): TopicStatus {
  const completed = input.exams.some(
    (exam) => exam.topicId === input.topicId && exam.completedAt !== null,
  )

  if (completed) {
    return "completed"
  }

  // An introduction only counts for a pack that is still in the content. A
  // topic whose packs have all been archived has nothing left to be Learning.
  const topicPacks = new Set(
    input.packs
      .filter((pack) => pack.topicId === input.topicId)
      .map((pack) => pack.id),
  )

  if (topicPacks.size === 0) {
    return "none"
  }

  return input.introductions.some((row) => topicPacks.has(row.packId))
    ? "learning"
    : "none"
}
