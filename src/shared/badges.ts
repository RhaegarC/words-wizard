import type { TopicExamState } from "./exam"
import { METRIC_NAMES, type MetricName } from "./metrics"
import type { SessionCommitPayload } from "./provider"
import type { Metric, Profile } from "./types"

/**
 * Feature 37. Badges are derived, never stored: every fact below is monotonic
 * (a cumulative counter, `bestStreak`, `completedSessions`, or sticky topic
 * completion), so a badge cannot be un-earned and there is no table, no earned
 * date and no seen state.
 */

export const MEDAL_CATEGORIES = [
  "collection",
  "mastery",
  "streak",
  "sessions",
  "reviews",
] as const

export type MedalCategory = (typeof MEDAL_CATEGORIES)[number]

export const TOPIC_CATEGORY = "topics"

export type BadgeCategory = MedalCategory | typeof TOPIC_CATEGORY

export const MEDAL_TIERS = ["bronze", "silver", "gold"] as const

export type MedalTier = (typeof MEDAL_TIERS)[number]

export type BadgeTier = MedalTier | "trophy"

export interface BadgeFacts {
  /** Cumulative `word.learned` metric, never a live Collection count. */
  wordsLearned: number
  /** Cumulative `word.mastered` metric, which a demotion cannot lower. */
  wordsMastered: number
  bestStreak: number
  completedSessions: number
  /** Cumulative `monthlyReview.completed` metric. */
  monthlyReviews: number
  completedTopicIds: readonly string[]
}

export type BadgeFactKey = keyof BadgeFacts

export interface BadgeDefinition {
  id: string
  category: BadgeCategory
  /** Medals are bronze → gold; a topic trophy has no tier. */
  tier: BadgeTier
  /** `null` on a trophy: it completes, it does not count. */
  threshold: number | null
  fact: BadgeFactKey
  /** Set on trophies only, so the name can be read from content. */
  topicId?: string
}

/**
 * The fifteen static medals, in catalogue order. Trophies are appended per
 * live topic by `buildBadgeCatalogue`.
 */
export const MEDAL_DEFINITIONS: readonly BadgeDefinition[] = [
  { id: "collection.bronze", category: "collection", tier: "bronze", threshold: 10, fact: "wordsLearned" },
  { id: "collection.silver", category: "collection", tier: "silver", threshold: 50, fact: "wordsLearned" },
  { id: "collection.gold", category: "collection", tier: "gold", threshold: 100, fact: "wordsLearned" },
  { id: "mastery.bronze", category: "mastery", tier: "bronze", threshold: 1, fact: "wordsMastered" },
  { id: "mastery.silver", category: "mastery", tier: "silver", threshold: 10, fact: "wordsMastered" },
  { id: "mastery.gold", category: "mastery", tier: "gold", threshold: 50, fact: "wordsMastered" },
  { id: "streak.bronze", category: "streak", tier: "bronze", threshold: 3, fact: "bestStreak" },
  { id: "streak.silver", category: "streak", tier: "silver", threshold: 7, fact: "bestStreak" },
  { id: "streak.gold", category: "streak", tier: "gold", threshold: 30, fact: "bestStreak" },
  { id: "sessions.bronze", category: "sessions", tier: "bronze", threshold: 10, fact: "completedSessions" },
  { id: "sessions.silver", category: "sessions", tier: "silver", threshold: 50, fact: "completedSessions" },
  { id: "sessions.gold", category: "sessions", tier: "gold", threshold: 100, fact: "completedSessions" },
  { id: "reviews.bronze", category: "reviews", tier: "bronze", threshold: 1, fact: "monthlyReviews" },
  { id: "reviews.silver", category: "reviews", tier: "silver", threshold: 5, fact: "monthlyReviews" },
  { id: "reviews.gold", category: "reviews", tier: "gold", threshold: 12, fact: "monthlyReviews" },
]

const TOPIC_TROPHY_PREFIX = "topic."

export function topicTrophyId(topicId: string): string {
  return `${TOPIC_TROPHY_PREFIX}${topicId}`
}

export function isTopicTrophyId(id: string): boolean {
  return id.startsWith(TOPIC_TROPHY_PREFIX)
}

/** The topic a trophy id names, or `null` for a medal id. */
export function topicIdFromTrophy(id: string): string | null {
  return isTopicTrophyId(id) ? id.slice(TOPIC_TROPHY_PREFIX.length) : null
}

/**
 * The catalogue the UI renders: the medals followed by one trophy per live
 * topic. A topic that is later archived keeps its trophy through
 * `completedTopicIds`; it simply stops appearing in this live catalogue.
 */
export function buildBadgeCatalogue(
  topicIds: readonly string[],
): BadgeDefinition[] {
  return [
    ...MEDAL_DEFINITIONS,
    ...topicIds.map(
      (topicId): BadgeDefinition => ({
        id: topicTrophyId(topicId),
        category: TOPIC_CATEGORY,
        tier: "trophy",
        threshold: null,
        fact: "completedTopicIds",
        topicId,
      }),
    ),
  ]
}

function factCount(definition: BadgeDefinition, facts: BadgeFacts): number {
  return definition.fact === "completedTopicIds"
    ? facts.completedTopicIds.length
    : Math.max(0, facts[definition.fact])
}

export function isBadgeUnlocked(
  definition: BadgeDefinition,
  facts: BadgeFacts,
): boolean {
  if (definition.tier === "trophy") {
    return (
      definition.topicId !== undefined &&
      facts.completedTopicIds.includes(definition.topicId)
    )
  }

  return factCount(definition, facts) >= (definition.threshold ?? 0)
}

/**
 * The unlocked ids in catalogue order: the medals this profile has reached,
 * then one trophy per completed topic. Order is definition order for medals
 * and the facts' own order for trophies, so a result is stable without dates.
 */
export function deriveBadges(facts: BadgeFacts): string[] {
  const medals = MEDAL_DEFINITIONS.filter((definition) =>
    isBadgeUnlocked(definition, facts),
  ).map((definition) => definition.id)

  const trophies = [...new Set(facts.completedTopicIds)].map(topicTrophyId)

  return [...medals, ...trophies]
}

/** Ids earned by `after` that `before` did not have, in `after`'s order. */
export function newlyEarned(
  before: BadgeFacts,
  after: BadgeFacts,
): string[] {
  const earned = new Set(deriveBadges(before))

  return deriveBadges(after).filter((id) => !earned.has(id))
}

export interface BadgeProgress {
  /** Clamped at the target, so an over-achieved medal reads complete. */
  current: number
  target: number
  remaining: number
}

export function badgeProgress(
  definition: BadgeDefinition,
  facts: BadgeFacts,
): BadgeProgress {
  if (definition.tier === "trophy") {
    const current = isBadgeUnlocked(definition, facts) ? 1 : 0

    return { current, target: 1, remaining: 1 - current }
  }

  const target = definition.threshold ?? 0
  const current = Math.min(factCount(definition, facts), target)

  return { current, target, remaining: target - current }
}

const TIER_RANK: Readonly<Record<MedalTier, number>> = {
  bronze: 0,
  silver: 1,
  gold: 2,
}

/**
 * The Home card's "featured" badge: the highest-tier unlocked medal, earliest
 * in catalogue order on a tie; failing that, the first unlocked trophy. This
 * is a presentation rule, not a chronology — badges carry no earned date.
 */
export function featuredBadge(
  facts: BadgeFacts,
  catalogue: readonly BadgeDefinition[],
): BadgeDefinition | null {
  let best: BadgeDefinition | null = null
  let bestRank = -1

  for (const definition of catalogue) {
    if (definition.tier === "trophy" || !isBadgeUnlocked(definition, facts)) {
      continue
    }

    const rank = TIER_RANK[definition.tier]

    // Strictly greater, so the earliest definition wins a tier tie.
    if (rank > bestRank) {
      best = definition
      bestRank = rank
    }
  }

  return (
    best ??
    catalogue.find(
      (definition) =>
        definition.tier === "trophy" && isBadgeUnlocked(definition, facts),
    ) ??
    null
  )
}

export interface NextGoal extends BadgeProgress {
  badge: BadgeDefinition
}

/**
 * The nearest locked badge: the smallest remaining amount, earliest in
 * catalogue order on a tie. A locked trophy is always one away.
 */
export function nextGoal(
  facts: BadgeFacts,
  catalogue: readonly BadgeDefinition[],
): NextGoal | null {
  let best: NextGoal | null = null

  for (const definition of catalogue) {
    const progress = badgeProgress(definition, facts)

    if (progress.remaining <= 0) {
      continue
    }

    if (best === null || progress.remaining < best.remaining) {
      best = { badge: definition, ...progress }
    }
  }

  return best
}

/** Build the fact set from the stored rows the app already reads. */
export function badgeFacts(input: {
  profile: Pick<Profile, "bestStreak" | "completedSessions">
  metrics: readonly Pick<Metric, "name" | "value">[]
  exams: readonly Pick<TopicExamState, "topicId" | "completedAt">[]
}): BadgeFacts {
  const byName = new Map(
    input.metrics.map((metric) => [metric.name, metric.value]),
  )
  const counter = (name: string): number =>
    Math.max(0, byName.get(name) ?? 0)

  const completedTopicIds: string[] = []

  for (const exam of input.exams) {
    if (
      exam.completedAt !== null &&
      !completedTopicIds.includes(exam.topicId)
    ) {
      completedTopicIds.push(exam.topicId)
    }
  }

  return {
    wordsLearned: counter(METRIC_NAMES.wordLearned),
    wordsMastered: counter(METRIC_NAMES.wordMastered),
    bestStreak: Math.max(0, input.profile.bestStreak),
    completedSessions: Math.max(0, input.profile.completedSessions),
    monthlyReviews: counter(METRIC_NAMES.monthlyReviewCompleted),
    completedTopicIds,
  }
}

/**
 * The facts after a saved session: the commit's metric deltas and profile
 * patch are the same values the Worker stores. A session never changes topic
 * completion, so the trophy list carries over untouched.
 */
export function factsAfterSession(
  before: BadgeFacts,
  commit: Pick<SessionCommitPayload, "metrics" | "profile">,
): BadgeFacts {
  const delta = (name: MetricName): number =>
    Math.max(0, commit.metrics[name] ?? 0)

  return {
    wordsLearned: before.wordsLearned + delta(METRIC_NAMES.wordLearned),
    wordsMastered: before.wordsMastered + delta(METRIC_NAMES.wordMastered),
    bestStreak: commit.profile.bestStreak ?? before.bestStreak,
    completedSessions:
      commit.profile.completedSessions ?? before.completedSessions,
    monthlyReviews:
      before.monthlyReviews + delta(METRIC_NAMES.monthlyReviewCompleted),
    completedTopicIds: before.completedTopicIds,
  }
}

/**
 * The facts after an exam part: only the final pass adds a completed topic,
 * and nothing else the exam does is a badge fact. A retake leaves the set
 * exactly as it was.
 */
export function factsAfterExamCompletion(
  before: BadgeFacts,
  topicId: string,
  completedAt: number | null,
): BadgeFacts {
  if (completedAt === null || before.completedTopicIds.includes(topicId)) {
    return before
  }

  return {
    ...before,
    completedTopicIds: [...before.completedTopicIds, topicId],
  }
}
