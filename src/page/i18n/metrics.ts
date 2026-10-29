import { METRIC_NAMES, type MetricName } from "@shared/metrics"

import type { MessageKey } from "./messages"

/**
 * Diagnostics labels for PRD §15's local counters. Keeping the mapping here
 * means a new counter is a compile error until it has a bilingual label.
 */
export const METRIC_LABEL_KEYS: Record<MetricName, MessageKey> = {
  [METRIC_NAMES.sessionStarted]: "settings.counter.sessionStarted",
  [METRIC_NAMES.sessionCompleted]: "settings.counter.sessionCompleted",
  [METRIC_NAMES.sessionAbandoned]: "settings.counter.sessionAbandoned",
  [METRIC_NAMES.wordLearned]: "settings.counter.wordLearned",
  [METRIC_NAMES.wordMastered]: "settings.counter.wordMastered",
  [METRIC_NAMES.stageUp]: "settings.counter.stageUp",
  [METRIC_NAMES.xpEarned]: "settings.counter.xpEarned",
  [METRIC_NAMES.collectionOpened]: "settings.counter.collectionOpened",
  [METRIC_NAMES.wordBookOpened]: "settings.counter.wordBookOpened",
  [METRIC_NAMES.monthlyReviewOffered]: "settings.counter.monthlyReviewOffered",
  [METRIC_NAMES.monthlyReviewCompleted]:
    "settings.counter.monthlyReviewCompleted",
  [METRIC_NAMES.reviewStrengthDelta]: "settings.counter.reviewStrengthDelta",
  [METRIC_NAMES.revivalSession]: "settings.counter.revivalSession",
  [METRIC_NAMES.revivalQuickWake]: "settings.counter.revivalQuickWake",
}
