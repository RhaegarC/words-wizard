import type { Metric, Profile, Progress, SessionKind } from "./types"
import type { MetricName } from "./metrics"
import type { CareAction, PackIntroduction } from "./me"

/** A profile as created by feature 06; the API fixes the id from the token. */
export type NewProfile = Omit<Profile, "id">

/** Fields a screen or the session commit may change; id and createdAt are fixed. */
export type ProfilePatch = Partial<Omit<Profile, "id" | "createdAt">>

/** One word introduced in one pack, as the commit writes it. */
export interface IntroductionWrite {
  packId: string
  wordId: string
}

/** The session record carried alongside a commit. */
export interface SessionRecordInput {
  id: string
  kind: SessionKind
  localDate: string
  contentVersion: string
  finishedAt: number
}

/** What `commitSession` did with a payload. */
export type CommitOutcome = "saved" | "queued"

/** One progress row inside a session commit; the id comes from the token. */
export type SessionProgressWrite = Omit<Progress, "profileId">

/**
 * The single input to `commitSession`. Feature 09 builds it from a
 * `SessionResult`; the provider validates it before sending it.
 */
export interface SessionCommitPayload {
  profileId: string
  /** Session end. Metric rows use it as `updatedAt`. */
  now: number
  /** The session row the Worker stores under `(user, id)`. */
  session: SessionRecordInput
  /** Answer XP plus the completion bonus; never negative. */
  xpEarned: number
  /** Profile fields to merge onto the stored row. */
  profile: ProfilePatch
  /** The post-session state of every word the session touched. */
  progress: readonly SessionProgressWrite[]
  /** Packs in which this session introduced a word. */
  introductions: readonly IntroductionWrite[]
  /** Counter increments, keyed by a `METRIC_NAMES` value. */
  metrics: Partial<Record<MetricName, number>>
  /** Device-level flags set locally after a successful commit. */
  device?: Readonly<Record<string, unknown>>
}

/**
 * Every read and write of profile data goes through this seam. The online
 * provider implements it against the Worker; screens never call `fetch`.
 */
export interface ProgressProvider {
  /** The current identity's profile, or null before character creation. */
  getProfile(): Promise<Profile | null>
  /** Idempotent: returns the existing profile instead of adding a second. */
  createProfile(profile: NewProfile): Promise<Profile>
  updateProfile(id: string, patch: ProfilePatch): Promise<void>
  getProgress(profileId: string, wordId: string): Promise<Progress | null>
  getAllProgress(profileId: string): Promise<Progress[]>
  /** Rows recording which word was introduced in which pack. */
  getIntroductions(profileId: string): Promise<PackIntroduction[]>
  /** A retryable failure parks the payload in the outbox. */
  commitSession(payload: SessionCommitPayload): Promise<CommitOutcome>
  /** Best-effort counter write; a failure is not surfaced to the child. */
  incrementMetric(
    profileId: string,
    name: MetricName,
    delta?: number,
  ): Promise<void>
  getMetrics(profileId: string): Promise<Metric[]>
  /** The server applies the same pure Care rules as the page. */
  applyCare(action: CareAction): Promise<Profile>
  getDevice(key: string): Promise<unknown>
  setDevice(key: string, value: unknown): Promise<void>
}
