import { config } from "./config"

import { daysSinceLocal } from "./time"
import type { CharacterCondition, Profile } from "./types"

/**
 * PRD §7.2. Vitality and sleep are derived, never stored: the only inputs are
 * the two timestamps that count as activity, the frozen-day allowance, and XP.
 *
 * This module deliberately stops before the stage so the session commit can
 * ask "was this character asleep?" without importing the progression module
 * that already imports it.
 */

export type DormancyProfile = Pick<Profile, "createdAt" | "lastPracticeAt" | "lastWakeAt" | "frozenDays">

export function deriveEffectiveDaysIdle(
  profile: DormancyProfile,
  now: number,
): number {
  // A quick wake is activity for the dormancy clock even though it is not
  // practice: it moves the anchor without touching `lastPracticeAt`.
  const anchor = Math.max(
    profile.createdAt,
    profile.lastPracticeAt,
    profile.lastWakeAt ?? 0,
  )

  return Math.max(0, daysSinceLocal(anchor, now) - profile.frozenDays)
}

export function deriveVitality(effectiveDaysIdle: number): number {
  const vitality =
    100 - config.dormancy.vitalityPerDay * Math.max(0, effectiveDaysIdle)

  return Math.min(100, Math.max(0, vitality))
}

export function deriveCondition(effectiveDaysIdle: number): CharacterCondition {
  if (effectiveDaysIdle >= config.dormancy.sleepDay) {
    return "sleeping"
  }

  return effectiveDaysIdle >= config.dormancy.sleepyDay ? "sleepy" : "awake"
}
