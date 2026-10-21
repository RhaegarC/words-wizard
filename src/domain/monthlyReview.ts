import { config } from "../config"

import {
  assignSessionWords,
  type SessionPlan,
  type SessionSeed,
} from "./session"
import { daysSinceLocal } from "./time"
import type { Profile, Progress, Word } from "./types"

/**
 * PRD §7.4. A review is offered, never imposed. This is the trigger only;
 * feature 13 owns word selection and the review session itself.
 *
 * When no review has run, the clock starts at the fifth learned word's
 * `firstSeenAt`, so no extra stored field is needed.
 */
export function isMonthlyReviewDue(
  profile: Pick<Profile, "id" | "lastMonthlyReviewAt">,
  progress: readonly Progress[],
  now: number,
): boolean {
  const learned = progress
    .filter((row) => row.profileId === profile.id && row.status !== "new")
    .sort(
      (left, right) =>
        left.firstSeenAt - right.firstSeenAt ||
        left.wordId.localeCompare(right.wordId),
    )

  if (learned.length < config.monthlyReview.minLearned) {
    return false
  }

  const anchor =
    profile.lastMonthlyReviewAt ??
    learned[config.monthlyReview.minLearned - 1].firstSeenAt

  return daysSinceLocal(anchor, now) >= config.monthlyReview.intervalDays
}

/**
 * PRD §7.4. At 20 or more learned words: the 17 lowest strength, up to three
 * high-strength confirmations, then the oldest remaining words up to the cap.
 * Every ordering falls back to `wordId`, so the same profile always gets the
 * same review.
 */
export function selectReviewWords(
  progress: readonly Progress[],
  words: readonly Word[],
  cap: number = config.monthlyReview.cap,
): string[] {
  const wordsById = new Map(words.map((word) => [word.id, word]))
  const latest = new Map<string, Progress>()

  for (const row of progress) {
    if (row.status === "new" || !wordsById.has(row.wordId)) {
      continue
    }

    const current = latest.get(row.wordId)

    if (current === undefined || row.lastSeenAt > current.lastSeenAt) {
      latest.set(row.wordId, row)
    }
  }

  const learned = [...latest.values()]

  if (learned.length <= cap) {
    return [...learned].sort(byStrengthThenOldest).map((row) => row.wordId)
  }

  const lowCount = Math.max(
    0,
    cap - config.monthlyReview.highStrengthConfirmations,
  )
  const selected = [...learned].sort(byStrengthThenOldest).slice(0, lowCount)
  const selectedIds = new Set(selected.map((row) => row.wordId))
  const remaining = learned.filter((row) => !selectedIds.has(row.wordId))

  const confirmations = remaining
    .filter((row) => row.strength >= config.scheduler.masteredStrength)
    .sort(byOldest)
    .slice(0, config.monthlyReview.highStrengthConfirmations)

  for (const row of confirmations) {
    selectedIds.add(row.wordId)
  }

  const filler = remaining
    .filter((row) => !selectedIds.has(row.wordId))
    .sort(byOldest)

  return [...selected, ...confirmations, ...filler]
    .slice(0, cap)
    .map((row) => row.wordId)
}

export interface BuildReviewInput {
  profile: Pick<Profile, "id">
  progress: readonly Progress[]
  words: readonly Word[]
  now: number
  seed: SessionSeed
  speechAvailable: boolean
}

/** One review exercise per selected word; never an intro card or a new word. */
export function buildReview(input: BuildReviewInput): SessionPlan {
  const rows =
    input.profile.id === undefined
      ? []
      : input.progress.filter((row) => row.profileId === input.profile.id)
  const entries = selectReviewWords(
    rows,
    input.words,
    config.monthlyReview.cap,
  ).map((wordId) => ({ wordId, kind: "review" as const }))
  const words = assignSessionWords(entries, input.seed, input.speechAvailable)

  return { words, caughtUp: words.length === 0 }
}

function byStrengthThenOldest(left: Progress, right: Progress): number {
  return (
    left.strength - right.strength ||
    left.lastSeenAt - right.lastSeenAt ||
    left.wordId.localeCompare(right.wordId)
  )
}

function byOldest(left: Progress, right: Progress): number {
  return (
    left.lastSeenAt - right.lastSeenAt ||
    left.wordId.localeCompare(right.wordId)
  )
}
