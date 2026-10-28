import type { Metric, Profile, Progress } from "./types"
import type { MetricName } from "./metrics"

/** A profile as created by feature 06; Dexie assigns the id. */
export type NewProfile = Omit<Profile, "id">

/** Fields a screen or the session commit may change; id and createdAt are fixed. */
export type ProfilePatch = Partial<Omit<Profile, "id" | "createdAt">>

/**
 * One progress row inside a session commit. `profileId` is supplied by the
 * payload, and `id` is resolved by the provider through the compound index, so
 * feature 09 only has to describe the post-session state of a word.
 */
export type SessionProgressWrite = Omit<Progress, "id" | "profileId">

/**
 * The single input to `commitSession`. Feature 09 builds it from a
 * `SessionResult`; the provider validates it before opening a transaction.
 */
export interface SessionCommitPayload {
  profileId: number
  /** Session end. Metric rows use it as `updatedAt`. */
  now: number
  /** Answer XP plus the completion bonus; never negative. */
  xpEarned: number
  /** Profile fields to merge onto the stored row. */
  profile: ProfilePatch
  /** The post-session state of every word the session touched. */
  progress: readonly SessionProgressWrite[]
  /** Counter increments, keyed by a `METRIC_NAMES` value. */
  metrics: Partial<Record<MetricName, number>>
  /** Device-level flags to set, e.g. a one-off install marker. */
  device?: Readonly<Record<string, unknown>>
}

/**
 * Every read and write of profile data goes through this seam. A future sync
 * layer can implement it without a screen changing.
 */
export interface ProgressProvider {
  getProfile(): Promise<Profile | null>
  /** Idempotent: returns the existing profile instead of adding a second. */
  createProfile(profile: NewProfile): Promise<Profile>
  updateProfile(id: number, patch: ProfilePatch): Promise<void>
  getProgress(profileId: number, wordId: string): Promise<Progress | null>
  getAllProgress(profileId: number): Promise<Progress[]>
  commitSession(payload: SessionCommitPayload): Promise<void>
  incrementMetric(
    profileId: number,
    name: MetricName,
    delta?: number,
  ): Promise<void>
  getMetrics(profileId: number): Promise<Metric[]>
  getDevice(key: string): Promise<unknown>
  setDevice(key: string, value: unknown): Promise<void>
}
