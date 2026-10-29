import { config } from "./config"

/**
 * Canonical records and shared vocabulary from PRD §6–§8.
 *
 * These are the shapes every later feature imports. Runtime constants live beside their
 * types so exhaustiveness can be checked in tests instead of inferred from casts.
 */

export type StageId = typeof config.stages[number]["id"]

export const STAGE_IDS: readonly StageId[] = config.stages.map(
  (stage) => stage.id,
)

export const PRACTICE_MODES = [
  "pictureMatch",
  "wordToMeaning",
  "spellingBuilder",
  "fillBlank",
  "listenChoose",
] as const

export type PracticeMode = typeof PRACTICE_MODES[number]

export type Locale = "en" | "zh"

export type WordLevel = 1 | 2 | 3

export interface WordExample {
  en: string
  zh: string
}

/** PRD §6.4. */
export interface Word {
  id: string
  text: string
  phonetic: string
  partOfSpeech: string
  meaningEn: string
  meaningZh: string
  definitionEn: string
  definitionZh: string
  examples: WordExample[]
  /** R2 URL, or null until artwork exists (Mission 2 model). */
  image: string | null
  emoji?: string
  level: WordLevel
  tags: string[]
  /** Derived from active pack membership; never stored. */
  topicIds: string[]
}

/** PRD §6.5. */
export interface Topic {
  id: string
  title: string
  titleZh: string
  icon: string
  description: string
  descriptionZh: string
  sortOrder: number
}

/** PRD §6.5. */
export interface Pack {
  id: string
  title: string
  titleZh: string
  topicId: string
  /** Derived from `pack_words.position`. */
  wordIds: string[]
  /** `packs.sort_order`. */
  order: number
}

/** PRD §8.3. */
export interface Profile {
  id?: number
  name: string
  characterName: string
  avatar: string
  /** Null until the topic picker completes (feature 06). */
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

export type ProgressStatus = "new" | "learning" | "mastered"

/** PRD §8.3. One row per `profileId` + `wordId`. */
export interface Progress {
  id?: number
  profileId: number
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

/** PRD §8.3, §15. Local counters only; never sent anywhere. */
export interface Metric {
  id?: number
  profileId: number
  name: string
  value: number
  updatedAt: number
}

/** PRD §8.3. Device-level key/value state, not scoped to a profile. */
export interface Device {
  key: string
  value: unknown
}

export type CharacterCondition = "awake" | "sleepy" | "sleeping"

/** PRD §7.2. Derived on every render; never stored. */
export interface CharacterState {
  effectiveDaysIdle: number
  vitality: number
  state: CharacterCondition
  stage: StageId
}

export type SessionKind = "daily" | "monthly"

export interface SessionAttempt {
  wordId: string
  mode: PracticeMode
  correct: boolean
  hintLevel: 0 | 1 | 2
  revealed: boolean
  /** Every miss on this exercise; feature 09 applies one scheduler penalty each. */
  wrongTaps: number
  xp: number
}

export interface SessionWordResult {
  wordId: string
  firstAttemptCorrect: boolean
  attempts: SessionAttempt[]
}

/** PRD §5, §7.4. Produced by the session engine, committed once by feature 09. */
export interface SessionResult {
  id: string
  kind: SessionKind
  startedAt: number
  completedAt: number
  words: SessionWordResult[]
  /** Answer XP only; the +5 completion bonus is added during the commit. */
  xpEarned: number
}
