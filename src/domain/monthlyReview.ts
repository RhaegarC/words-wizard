import { config } from "../config"

import { daysSinceLocal } from "./time"
import type { Profile, Progress } from "./types"

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
