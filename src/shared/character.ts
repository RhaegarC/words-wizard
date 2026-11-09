import { config } from "./config"

import {
  deriveCondition,
  deriveEffectiveDaysIdle,
  deriveVitality,
} from "./dormancy"
import {
  applyCareTokenGrant,
  daysBetweenLocalDates,
  deriveStage,
} from "./progression"
import { localDateKey, shiftLocalDays } from "./time"
import type { CharacterState, Profile } from "./types"

/**
 * PRD §7.2, §7.5. A character's state is derived, never stored, and both
 * Care Token spends are pure profile transforms. Rejections are typed so a
 * screen can explain them without guessing, and return the original profile
 * untouched.
 */

export { deriveVitality }

export type SpendReason = "no-tokens" | "sleeping" | "not-sleeping"

export interface SpendAllowed {
  allowed: true
}

export interface SpendRejected {
  allowed: false
  reason: SpendReason
}

export type SpendCheck = SpendAllowed | SpendRejected

export interface SpendSucceeded {
  spent: true
  profile: Profile
}

export interface SpendFailed {
  spent: false
  reason: SpendReason
  profile: Profile
}

export type SpendOutcome = SpendSucceeded | SpendFailed

export function deriveCharacterState(
  profile: Pick<Profile, "createdAt" | "lastPracticeAt" | "lastWakeAt" | "frozenDays" | "xp">,
  now: number,
): CharacterState {
  const effectiveDaysIdle = deriveEffectiveDaysIdle(profile, now)

  return {
    effectiveDaysIdle,
    vitality: deriveVitality(effectiveDaysIdle),
    state: deriveCondition(effectiveDaysIdle),
    stage: deriveStage(profile.xp),
  }
}

/** Freeze covers a day while awake or sleepy; sleeping is quick-wake's job. */
export function canFreeze(profile: Profile, now: number): SpendCheck {
  if (deriveCharacterState(profile, now).state === "sleeping") {
    return { allowed: false, reason: "sleeping" }
  }

  return profile.careTokens > 0
    ? { allowed: true }
    : { allowed: false, reason: "no-tokens" }
}

/** Quick wake is only meaningful while sleeping. */
export function canQuickWake(profile: Profile, now: number): SpendCheck {
  if (deriveCharacterState(profile, now).state !== "sleeping") {
    return { allowed: false, reason: "not-sleeping" }
  }

  return profile.careTokens > 0
    ? { allowed: true }
    : { allowed: false, reason: "no-tokens" }
}

/**
 * Freeze one day: the dormancy clock extends and, when the covered day was a
 * missed day inside the grace window, it also counts for the streak. A day the
 * child already practiced is not missed, so the streak stays put.
 */
export function spendOnFreeze(profile: Profile, now: number): SpendOutcome {
  const check = canFreeze(profile, now)

  if (!check.allowed) {
    return { spent: false, reason: check.reason, profile }
  }

  const care = spendToken(profile)
  const covered = coveredStreakDay(profile, now)

  return {
    spent: true,
    profile: {
      ...profile,
      ...care,
      ...covered,
      frozenDays: profile.frozenDays + 1,
    },
  }
}

/**
 * Quick wake: the character is awake immediately. It is not practice, so
 * everything the session ledger owns is left byte-identical.
 */
export function spendOnQuickWake(profile: Profile, now: number): SpendOutcome {
  const check = canQuickWake(profile, now)

  if (!check.allowed) {
    return { spent: false, reason: check.reason, profile }
  }

  return {
    spent: true,
    profile: {
      ...profile,
      ...spendToken(profile),
      lastWakeAt: now,
      frozenDays: 0,
    },
  }
}

function coveredStreakDay(
  profile: Profile,
  now: number,
): Pick<Profile, "streakCount" | "bestStreak" | "lastStreakDate"> {
  const unchanged = {
    streakCount: profile.streakCount,
    bestStreak: profile.bestStreak,
    lastStreakDate: profile.lastStreakDate,
  }
  const today = localDateKey(now)

  if (profile.lastStreakDate === null || profile.lastStreakDate === today) {
    return unchanged
  }

  const coveredDay = localDateKey(shiftLocalDays(now, -1))
  const gap = daysBetweenLocalDates(profile.lastStreakDate, coveredDay)

  if (gap < 1 || gap > config.streak.graceDays) {
    return unchanged
  }

  const streakCount = profile.streakCount + 1

  return {
    streakCount,
    bestStreak: Math.max(profile.bestStreak, streakCount),
    lastStreakDate: coveredDay,
  }
}

/**
 * One token out. A token is queued only when the counter already holds at five
 * at the cap: spending then re-grants it, so the child sees the counter reset
 * and still holds three. Below that, spending must not also advance the earn
 * counter or the action would be partly free.
 */
function spendToken(
  profile: Profile,
): Pick<Profile, "careTokens" | "sessionsSinceLastToken"> {
  const afterSpend = {
    careTokens: profile.careTokens - 1,
    sessionsSinceLastToken: profile.sessionsSinceLastToken,
  }
  const tokenQueued =
    profile.careTokens >= config.careTokens.cap &&
    profile.sessionsSinceLastToken >= config.careTokens.sessionsPerToken

  return tokenQueued ? applyCareTokenGrant(afterSpend) : afterSpend
}
