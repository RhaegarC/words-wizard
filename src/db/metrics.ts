/**
 * Local counter names from PRD §15. These are the only strings written to
 * `Metric.name`; screens and the session commit import the constants so a
 * counter cannot drift into a lookalike spelling.
 *
 * Install status and the `persist()` result are device keys (PRD §8.3), not
 * metrics, because they describe the device rather than a profile's activity.
 */
export const METRIC_NAMES = {
  sessionStarted: "session.started",
  sessionCompleted: "session.completed",
  sessionAbandoned: "session.abandoned",
  wordLearned: "word.learned",
  wordMastered: "word.mastered",
  stageUp: "stage.up",
  collectionOpened: "collection.opened",
  wordBookOpened: "wordBook.opened",
  monthlyReviewOffered: "monthlyReview.offered",
  monthlyReviewCompleted: "monthlyReview.completed",
  /** Signed sum: a review that finds decay lowers the total. */
  reviewStrengthDelta: "monthlyReview.strengthDelta",
  revivalSession: "revival.session",
  revivalQuickWake: "revival.quickWake",
} as const

export type MetricName = (typeof METRIC_NAMES)[keyof typeof METRIC_NAMES]

export const METRIC_NAME_VALUES: readonly MetricName[] =
  Object.values(METRIC_NAMES)
