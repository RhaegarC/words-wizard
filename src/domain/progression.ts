import { config } from "../config"
import { METRIC_NAMES, type MetricName } from "../db/metrics"
import type {
  ProfilePatch,
  SessionCommitPayload,
  SessionProgressWrite,
} from "../db/provider"

import { deriveCondition, deriveEffectiveDaysIdle } from "./dormancy"
import {
  daysSinceLocal,
  localDateKey,
  startOfLocalDayKey,
} from "./time"
import type {
  Profile,
  Progress,
  ProgressStatus,
  SessionResult,
  StageId,
} from "./types"

/**
 * PRD §5.3, §7, §9. Every rule of the session commit is a pure function; the
 * transaction itself lives in `session/commit.ts`. Nothing here reads storage.
 */

const DAY_MS = 86_400_000

/** A profile read at boot always has an id; the commit cannot be built without it. */
export type SessionProfile = Profile & { id: number }

export interface StageProgress {
  stage: StageId
  nextStage: StageId | null
  xpIntoStage: number
  xpForNextStage: number
  /** 0–1; a full bar at the highest stage. */
  fraction: number
}

export interface StreakState {
  streakCount: number
  bestStreak: number
  lastStreakDate: string
}

export interface XpAward {
  answer: number
  completion: number
  mastery: number
  total: number
}

export interface SessionSummary {
  wordsPracticed: number
  wordsMastered: number
  xpEarned: number
  stageBefore: StageId
  stageAfter: StageId
  progress: StageProgress
  streakCount: number
  bestStreak: number
  careTokens: number
  sessionsSinceLastToken: number
}

export interface SessionCommit {
  payload: SessionCommitPayload
  summary: SessionSummary
}

/**
 * Apply one scheduler delta. A correct answer is +0.2 and a wrong tap -0.3,
 * both clamped to 0–1. Strength is kept at two decimals so repeated additions
 * cannot drift a boundary (0.8 is exactly 0.8).
 */
export function applyAttempt(progress: Progress, correct: boolean): Progress {
  const delta = correct
    ? config.scheduler.correctDelta
    : config.scheduler.wrongDelta

  return {
    ...progress,
    strength: clampStrength(progress.strength + delta),
    correctCount: progress.correctCount + (correct ? 1 : 0),
    wrongCount: progress.wrongCount + (correct ? 0 : 1),
  }
}

/** The documented intervals are 1 / 2 / 4 / 7 / 14 / 30 days. */
export function intervalDays(strength: number): number {
  const intervals = config.scheduler.intervals
  const clamped = Math.min(1, Math.max(0, strength))
  // Six bands over [0, 1]: each 0.2 step, with only 1.0 reaching the last one.
  const index = Math.min(
    Math.floor(clamped * (intervals.length - 1)),
    intervals.length - 1,
  )

  return intervals[index]
}

export function nextReviewAt(strength: number, now: number): number {
  return now + intervalDays(strength) * DAY_MS
}

/**
 * A progress row is never `new`: having a row means the word was learned.
 *
 * Becoming mastered needs both strength and repeated correct answers. A word
 * that is already mastered keeps that status until strength falls below the
 * demotion threshold — a single weak review does not undo it.
 */
export function resolveStatus(
  progress: Pick<Progress, "status" | "strength" | "correctCount">,
): ProgressStatus {
  if (
    progress.status === "mastered" &&
    progress.strength >= config.scheduler.demoteStrength
  ) {
    return "mastered"
  }

  return progress.strength >= config.scheduler.masteredStrength &&
    progress.correctCount >= config.scheduler.masteredCorrect
    ? "mastered"
    : "learning"
}

/** Answer XP is already on the result; the completion and mastery bonuses are not. */
export function awardXp(result: SessionResult, newlyMastered = 0): XpAward {
  const answer = result.xpEarned
  const completion = config.xp.sessionComplete
  const mastery = newlyMastered * config.xp.mastered

  return {
    answer,
    completion,
    mastery,
    total: answer + completion + mastery,
  }
}

export function deriveStage(xp: number): StageId {
  let stage: StageId = config.stages[0].id

  for (const candidate of config.stages) {
    if (xp >= candidate.minXp) {
      stage = candidate.id
    }
  }

  return stage
}

export function stageProgress(xp: number): StageProgress {
  const totalXp = Math.max(0, xp)
  const index = stageIndex(deriveStage(totalXp))
  const current = config.stages[index]
  const next = config.stages[index + 1]

  if (next === undefined) {
    return {
      stage: current.id,
      nextStage: null,
      xpIntoStage: totalXp - current.minXp,
      xpForNextStage: 0,
      fraction: 1,
    }
  }

  const span = next.minXp - current.minXp

  return {
    stage: current.id,
    nextStage: next.id,
    xpIntoStage: totalXp - current.minXp,
    xpForNextStage: span,
    fraction: Math.min(1, (totalXp - current.minXp) / span),
  }
}

/**
 * The streak runs on local calendar days. A gap of up to seven days pauses but
 * does not add: the next completed session still adds exactly one. A longer
 * gap starts over.
 */
export function calcStreak(
  profile: Pick<Profile, "streakCount" | "bestStreak" | "lastStreakDate">,
  todayKey: string,
): StreakState {
  let streakCount: number

  if (profile.lastStreakDate === todayKey) {
    streakCount = profile.streakCount
  } else {
    const gap =
      profile.lastStreakDate === null
        ? null
        : daysBetweenLocalDates(profile.lastStreakDate, todayKey)

    if (gap !== null && gap <= 0) {
      // A clock corrected backwards must not cost the child their streak;
      // any stored date in the future is treated as today.
      streakCount = profile.streakCount
    } else {
      const pauses =
        gap !== null && gap >= 1 && gap <= config.streak.graceDays

      streakCount = pauses ? profile.streakCount + 1 : 1
    }
  }

  return {
    streakCount,
    bestStreak: Math.max(profile.bestStreak, streakCount),
    lastStreakDate: todayKey,
  }
}

/** Whole local days from one `YYYY-MM-DD` key to another. */
export function daysBetweenLocalDates(from: string, to: string): number {
  return daysSinceLocal(startOfLocalDayKey(from), startOfLocalDayKey(to))
}

/**
 * One token per five completed sessions, capped at three. At the cap the
 * counter holds at five so the next session after a spend grants immediately.
 */
export function applyCareTokenGrant(
  profile: Pick<Profile, "careTokens" | "sessionsSinceLastToken">,
): Pick<Profile, "careTokens" | "sessionsSinceLastToken"> {
  const sessions = Math.min(
    profile.sessionsSinceLastToken + 1,
    config.careTokens.sessionsPerToken,
  )

  if (
    sessions >= config.careTokens.sessionsPerToken &&
    profile.careTokens < config.careTokens.cap
  ) {
    return {
      careTokens: profile.careTokens + 1,
      sessionsSinceLastToken: 0,
    }
  }

  return {
    careTokens: profile.careTokens,
    sessionsSinceLastToken: sessions,
  }
}

/**
 * Turn one completed session into the single payload feature 05 commits.
 * Every planned word with at least one attempt gets a row — including a word
 * whose answer was revealed.
 */
export function buildSessionCommit(
  result: SessionResult,
  profile: SessionProfile,
  existingProgress: readonly Progress[],
  now: number,
): SessionCommit {
  const existingByWord = new Map<string, Progress>()

  for (const row of existingProgress) {
    if (row.profileId === profile.id) {
      existingByWord.set(row.wordId, row)
    }
  }

  let learned = 0
  let mastered = 0
  const progress: SessionProgressWrite[] = []

  for (const word of result.words) {
    if (word.attempts.length === 0) {
      continue
    }

    const existing = existingByWord.get(word.wordId)

    if (existing === undefined) {
      learned += 1
    }

    let row: Progress = existing ?? {
      profileId: profile.id,
      wordId: word.wordId,
      status: "learning",
      strength: 0,
      nextReviewAt: now,
      correctCount: 0,
      wrongCount: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      masteryXpAwarded: false,
    }

    // Every wrong tap costs a penalty, not just the exercise; a correct answer
    // after hints still counts.
    for (const attempt of word.attempts) {
      for (let tap = 0; tap < attempt.wrongTaps; tap += 1) {
        row = applyAttempt(row, false)
      }

      if (attempt.correct) {
        row = applyAttempt(row, true)
      }
    }

    const status = resolveStatus(row)
    const newlyMastered = status === "mastered" && !row.masteryXpAwarded

    if (newlyMastered) {
      mastered += 1
    }

    progress.push(
      toProgressWrite({
        ...row,
        status,
        nextReviewAt: nextReviewAt(row.strength, now),
        lastSeenAt: now,
        masteryXpAwarded: row.masteryXpAwarded || newlyMastered,
      }),
    )
  }

  const xp = awardXp(result, mastered)
  const streak = calcStreak(profile, localDateKey(now))
  const care = applyCareTokenGrant(profile)
  const stageBefore = deriveStage(profile.xp)
  const stageAfter = deriveStage(profile.xp + xp.total)
  const stageUps = stageIndex(stageAfter) - stageIndex(stageBefore)

  const metrics: Partial<Record<MetricName, number>> = {
    [METRIC_NAMES.sessionCompleted]: 1,
    [METRIC_NAMES.xpEarned]: xp.total,
  }

  if (learned > 0) {
    metrics[METRIC_NAMES.wordLearned] = learned
  }

  if (mastered > 0) {
    metrics[METRIC_NAMES.wordMastered] = mastered
  }

  if (stageUps > 0) {
    metrics[METRIC_NAMES.stageUp] = stageUps
  }

  // Completing a session is the free revival path (PRD §7.5): the character
  // was asleep before this commit moved `lastPracticeAt`.
  if (
    deriveCondition(deriveEffectiveDaysIdle(profile, now)) === "sleeping"
  ) {
    metrics[METRIC_NAMES.revivalSession] = 1
  }

  const profilePatch: ProfilePatch = {
    xp: profile.xp + xp.total,
    lastPracticeAt: now,
    frozenDays: 0,
    completedSessions: profile.completedSessions + 1,
    streakCount: streak.streakCount,
    bestStreak: streak.bestStreak,
    lastStreakDate: streak.lastStreakDate,
    careTokens: care.careTokens,
    sessionsSinceLastToken: care.sessionsSinceLastToken,
  }

  if (result.kind === "monthly") {
    profilePatch.lastMonthlyReviewAt = now
  }

  return {
    payload: {
      profileId: profile.id,
      now,
      xpEarned: xp.total,
      profile: profilePatch,
      progress,
      metrics,
    },
    summary: {
      wordsPracticed: result.words.length,
      wordsMastered: mastered,
      xpEarned: xp.total,
      stageBefore,
      stageAfter,
      progress: stageProgress(profile.xp + xp.total),
      streakCount: streak.streakCount,
      bestStreak: streak.bestStreak,
      careTokens: care.careTokens,
      sessionsSinceLastToken: care.sessionsSinceLastToken,
    },
  }
}

function clampStrength(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100))
}

function stageIndex(stage: StageId): number {
  return config.stages.findIndex((candidate) => candidate.id === stage)
}

function toProgressWrite(row: Progress): SessionProgressWrite {
  return {
    wordId: row.wordId,
    status: row.status,
    strength: row.strength,
    nextReviewAt: row.nextReviewAt,
    correctCount: row.correctCount,
    wrongCount: row.wrongCount,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    masteryXpAwarded: row.masteryXpAwarded,
  }
}
