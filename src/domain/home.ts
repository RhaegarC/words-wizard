import type { config } from "../config"

import { deriveCharacterState } from "./character"
import type { Avatar } from "./content/types"
import { isMonthlyReviewDue } from "./monthlyReview"
import { stageProgress, type StageProgress } from "./progression"
import { buildSession, estimatedMinutes, sessionSeed } from "./session"
import type { CharacterState, Pack, Profile, Progress, Word } from "./types"

/**
 * PRD §7.2, §7.5, §9. Everything Home displays is derived here, so the
 * screen holds no date math, content lookup, or threshold of its own.
 *
 * The daily preview is the session builder's own rule, not a second copy:
 * Home must promise exactly what tapping Practice will deliver.
 */

export type AppConfig = typeof config

export interface HomeContent {
  packs: readonly Pack[]
  words: readonly Word[]
  avatars: readonly Avatar[]
  contentVersion: string
}

export interface BuildHomeViewInput {
  profile: Profile
  progress: readonly Progress[]
  content: HomeContent
  now: number
  config: AppConfig
}

export interface TokenProgress {
  careTokens: number
  cap: number
  sessionsSinceLastToken: number
  sessionsPerToken: number
  /** Null at the cap: more sessions cannot earn another token until one is spent. */
  sessionsToNextToken: number | null
  showHint: boolean
}

export interface HomeView {
  /** True when the profile has no topic; Home routes to the picker instead. */
  needsTopic: boolean
  /** The profile's avatar set, resolved from content. */
  avatar: Avatar | undefined
  character: CharacterState
  stage: StageProgress
  reviewsDue: number
  newWords: number
  /** Today's learned words, offered for extra practice. */
  practiceAgain: number
  /** What the daily session would take, for the Home estimate. */
  estimatedMinutes: number
  /** Words in the collection: seen at least once, and still in the content. */
  learnedCount: number
  caughtUp: boolean
  monthlyReviewDue: boolean
  streakCount: number
  bestStreak: number
  careTokens: number
  tokenProgress: TokenProgress
}

export function buildHomeView(input: BuildHomeViewInput): HomeView {
  const { profile, progress, content, now, config } = input
  // Home promises exactly what the session builder will deliver, including
  // its duration, so it asks the builder rather than re-deriving counts.
  const plan = buildSession({
    profile,
    progress,
    packs: content.packs,
    words: content.words,
    now,
    seed: sessionSeed(profile.id ?? -1, now, "daily", content.contentVersion),
    // Modes are not shown on Home, so speech capability is irrelevant here.
    speechAvailable: false,
  })
  const wordIds = new Set(content.words.map((word) => word.id))
  const learnedCount = progress.filter(
    (row) => row.status !== "new" && wordIds.has(row.wordId),
  ).length

  const sessionsPerToken = config.careTokens.sessionsPerToken
  const atCap = profile.careTokens >= config.careTokens.cap
  const remaining = Math.max(
    0,
    sessionsPerToken - profile.sessionsSinceLastToken,
  )

  return {
    needsTopic: profile.currentTopicId === null,
    avatar: content.avatars.find((avatar) => avatar.id === profile.avatar),
    character: deriveCharacterState(profile, now),
    stage: stageProgress(profile.xp),
    reviewsDue: plan.words.filter((word) => word.kind === "review").length,
    newWords: plan.words.filter((word) => word.kind === "new").length,
    practiceAgain: plan.words.filter((word) => word.kind === "repeat").length,
    estimatedMinutes: estimatedMinutes(plan),
    learnedCount,
    caughtUp: plan.caughtUp,
    monthlyReviewDue: isMonthlyReviewDue(profile, progress, now),
    streakCount: profile.streakCount,
    bestStreak: profile.bestStreak,
    careTokens: profile.careTokens,
    tokenProgress: {
      careTokens: profile.careTokens,
      cap: config.careTokens.cap,
      sessionsSinceLastToken: profile.sessionsSinceLastToken,
      sessionsPerToken,
      sessionsToNextToken: atCap ? null : remaining,
      showHint:
        !atCap && remaining > 0 && remaining <= config.careTokens.hintWithin,
    },
  }
}
