import packageJson from "../package.json"

import { localDateKey } from "./time"
import type { Device, Metric, Profile, Progress } from "./types"

/**
 * PRD §8.4 / feature 14. The backup is deliberately plain: explicit fields, no
 * store objects, and no `undefined` values, so `JSON.stringify` loses nothing.
 */

/** The shape of the export itself, independent of the database or content schema. */
export const EXPORT_SCHEMA_VERSION = 1

export const APP_VERSION = packageJson.version

export interface ExportMeta {
  schemaVersion: number
  contentVersion: string
  appVersion: string
}

export interface BuildExportInput {
  profile: Profile
  progress: readonly Progress[]
  metrics: readonly Metric[]
  device: readonly Device[]
  meta: ExportMeta
  /** The export moment; also the file's date. */
  now: number
}

export interface ExportPayload {
  schemaVersion: number
  contentVersion: string
  appVersion: string
  exportedAt: number
  profile: Profile
  progress: Progress[]
  metrics: Metric[]
  device: Record<string, unknown>
}

export function buildExport(input: BuildExportInput): ExportPayload {
  return {
    schemaVersion: input.meta.schemaVersion,
    contentVersion: input.meta.contentVersion,
    appVersion: input.meta.appVersion,
    exportedAt: input.now,
    profile: exportProfile(input.profile),
    progress: input.progress.map(exportProgress),
    metrics: input.metrics.map(exportMetric),
    device: exportDevice(input.device),
  }
}

/** `words-wizard-backup-YYYY-MM-DD.json`, on the child's local calendar. */
export function exportFileName(now: number): string {
  return `words-wizard-backup-${localDateKey(now)}.json`
}

function exportProfile(profile: Profile): Profile {
  return {
    ...(profile.id === undefined ? {} : { id: profile.id }),
    name: profile.name,
    characterName: profile.characterName,
    avatar: profile.avatar,
    currentTopicId: profile.currentTopicId,
    xp: profile.xp,
    createdAt: profile.createdAt,
    lastPracticeAt: profile.lastPracticeAt,
    lastWakeAt: profile.lastWakeAt,
    frozenDays: profile.frozenDays,
    careTokens: profile.careTokens,
    sessionsSinceLastToken: profile.sessionsSinceLastToken,
    completedSessions: profile.completedSessions,
    streakCount: profile.streakCount,
    bestStreak: profile.bestStreak,
    lastStreakDate: profile.lastStreakDate,
    lastMonthlyReviewAt: profile.lastMonthlyReviewAt,
    locale: profile.locale,
  }
}

function exportProgress(row: Progress): Progress {
  return {
    ...(row.id === undefined ? {} : { id: row.id }),
    profileId: row.profileId,
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

function exportMetric(row: Metric): Metric {
  return {
    ...(row.id === undefined ? {} : { id: row.id }),
    profileId: row.profileId,
    name: row.name,
    value: row.value,
    updatedAt: row.updatedAt,
  }
}

/** Device keys sort so two exports of the same state are byte-identical. */
function exportDevice(rows: readonly Device[]): Record<string, unknown> {
  const device: Record<string, unknown> = {}

  for (const row of [...rows].sort((left, right) =>
    left.key.localeCompare(right.key),
  )) {
    if (row.value !== undefined) {
      device[row.key] = row.value
    }
  }

  return device
}
