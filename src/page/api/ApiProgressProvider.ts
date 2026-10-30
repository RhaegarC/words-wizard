import type { PackIntroduction, MeResponse, ServerProfile } from "@shared/me"
import type { MetricName } from "@shared/metrics"
import type {
  CommitOutcome,
  NewProfile,
  ProfilePatch,
  ProgressProvider,
  SessionCommitPayload,
} from "@shared/provider"
import type { ServerSessionCommitPayload } from "@shared/sessionPayload"
import { validateSessionPayload } from "@shared/sessionPayload"
import type { Metric, Profile, Progress } from "@shared/types"

import { ApiError, type ApiClient } from "./client"
import { Outbox, type StorageLike } from "./outbox"

/**
 * `ProgressProvider` against the Worker.
 *
 * Every read answers from one `GET /v1/me` snapshot held in memory; boot
 * refreshes it, and every write that returns fresh state replaces it. A reload
 * re-fetches, so nothing about a person is persisted locally except the pending
 * commits and device flags.
 */

export const DEVICE_STORAGE_KEY = "words-wizard.device"

export interface ApiProgressProviderOptions {
  readonly client: ApiClient
  /** The verified token's `oid`, or null when nobody is signed in. */
  readonly identity: () => string | null
  readonly outbox?: Outbox
  readonly storage?: StorageLike
  readonly now?: () => number
}

export class ApiProgressProvider implements ProgressProvider {
  private readonly client: ApiClient
  private readonly identity: () => string | null
  private readonly outbox: Outbox | undefined
  private readonly storage: StorageLike | undefined
  private readonly now: () => number
  private snapshot: MeResponse | null = null

  constructor(options: ApiProgressProviderOptions) {
    this.client = options.client
    this.identity = options.identity
    this.outbox = options.outbox
    this.storage = options.storage
    this.now = options.now ?? Date.now
  }

  /** Re-read `/v1/me` and return the mapped profile (`null` before creation). */
  async refresh(): Promise<Profile | null> {
    const oid = this.requireIdentity()
    const response = await this.client.request<MeResponse>("/v1/me")

    this.snapshot = response

    return response.profile === null
      ? null
      : mapProfile(response.profile, oid)
  }

  async getProfile(): Promise<Profile | null> {
    const oid = this.requireIdentity()
    const snapshot = await this.ensureSnapshot()

    return snapshot.profile === null ? null : mapProfile(snapshot.profile, oid)
  }

  async createProfile(profile: NewProfile): Promise<Profile> {
    const oid = this.requireIdentity()
    const created = await this.client.request<ServerProfile>(
      "/v1/me/profile",
      {
        method: "POST",
        body: {
          characterName: profile.characterName,
          avatar: profile.avatar,
          currentTopicId: profile.currentTopicId,
          locale: profile.locale,
          now: this.now(),
        },
      },
    )

    // The server may have returned the existing profile rather than a new
    // one; refreshing is what makes the snapshot authoritative either way.
    await this.refresh()

    return mapProfile(created, oid)
  }

  async updateProfile(id: string, patch: ProfilePatch): Promise<void> {
    if (id !== this.requireIdentity()) {
      throw new Error(`Profile ${id} is not the signed-in identity`)
    }

    const body = toProfilePatch(patch)

    if (Object.keys(body).length === 0) {
      return
    }

    const updated = await this.client.request<ServerProfile>(
      "/v1/me/profile",
      { method: "PATCH", body },
    )

    if (this.snapshot !== null) {
      this.snapshot = { ...this.snapshot, profile: updated }
    }
  }

  async getProgress(
    profileId: string,
    wordId: string,
  ): Promise<Progress | null> {
    const rows = await this.getAllProgress(profileId)

    return rows.find((row) => row.wordId === wordId) ?? null
  }

  async getAllProgress(profileId: string): Promise<Progress[]> {
    if (profileId !== this.requireIdentity()) {
      return []
    }

    const snapshot = await this.ensureSnapshot()

    return snapshot.progress.map((row) => ({
      ...row,
      profileId,
    }))
  }

  async getIntroductions(profileId: string): Promise<PackIntroduction[]> {
    if (profileId !== this.requireIdentity()) {
      return []
    }

    return (await this.ensureSnapshot()).introductions
  }

  async getMetrics(profileId: string): Promise<Metric[]> {
    if (profileId !== this.requireIdentity()) {
      return []
    }

    const snapshot = await this.ensureSnapshot()

    return snapshot.metrics.map((row) => ({
      profileId,
      name: row.name,
      value: row.value,
      updatedAt: row.updatedAt,
    }))
  }

  async commitSession(
    payload: SessionCommitPayload,
  ): Promise<CommitOutcome> {
    const issues = validateSessionPayload(payload)

    if (issues.length > 0) {
      throw new Error(`Invalid session payload: ${issues.join(", ")}`)
    }

    try {
      await this.sendCommit(payload)
      this.outbox?.remove(payload.session.id)
      return "saved"
    } catch (error) {
      if (error instanceof ApiError && error.retryable) {
        this.outbox?.enqueue(payload, this.now())
        return "queued"
      }

      throw error
    }
  }

  /**
   * The raw send, without the outbox decision. Boot's drain replays a stored
   * payload through this so a still-failing replay is not re-queued under a
   * new timestamp.
   */
  async sendCommit(payload: SessionCommitPayload): Promise<MeResponse> {
    this.requireIdentity()

    const response = await this.client.request<MeResponse>(
      "/v1/me/sessions",
      { method: "POST", body: toServerPayload(payload) },
    )

    this.snapshot = response

    return response
  }

  async incrementMetric(
    profileId: string,
    name: MetricName,
    delta = 1,
  ): Promise<void> {
    if (profileId !== this.requireIdentity()) {
      throw new Error(`Metric ${name} was addressed to another identity`)
    }

    const body = { name, delta, eventId: eventId() }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.client.request("/v1/me/metrics", { method: "POST", body })
        return
      } catch (error) {
        if (attempt === 0 && error instanceof ApiError && error.retryable) {
          continue
        }

        throw error
      }
    }
  }

  async applyCare(action: "freeze" | "quickWake"): Promise<Profile> {
    const oid = this.requireIdentity()
    const response = await this.client.request<{ profile: ServerProfile }>(
      "/v1/me/care",
      { method: "POST", body: { action, eventId: eventId() } },
    )

    if (this.snapshot !== null) {
      this.snapshot = { ...this.snapshot, profile: response.profile }
    }

    return mapProfile(response.profile, oid)
  }

  async getDevice(key: string): Promise<unknown> {
    return this.readDevice()[key]
  }

  async setDevice(key: string, value: unknown): Promise<void> {
    const device = this.readDevice()
    device[key] = value

    try {
      this.storageOrLocal()?.setItem(DEVICE_STORAGE_KEY, JSON.stringify(device))
    } catch {
      // Device flags are supporting state; a blocked store costs a diagnostic,
      // not the app.
    }
  }

  private async ensureSnapshot(): Promise<MeResponse> {
    this.requireIdentity()

    if (this.snapshot === null) {
      await this.refresh()
    }

    if (this.snapshot === null) {
      throw new Error("The /v1/me snapshot could not be loaded")
    }

    return this.snapshot
  }

  private requireIdentity(): string {
    const oid = this.identity()

    if (oid === null || oid.trim() === "") {
      throw new Error("No signed-in identity")
    }

    return oid
  }

  private readDevice(): Record<string, unknown> {
    try {
      const raw = this.storageOrLocal()?.getItem(DEVICE_STORAGE_KEY)

      if (raw === null || raw === undefined) {
        return {}
      }

      const parsed: unknown = JSON.parse(raw)

      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }

  private storageOrLocal(): StorageLike | undefined {
    return this.storage ?? globalThis.localStorage
  }
}

function mapProfile(profile: ServerProfile, id: string): Profile {
  return { ...profile, id }
}

function toProfilePatch(patch: ProfilePatch): Record<string, unknown> {
  const body: Record<string, unknown> = {}

  if (patch.characterName !== undefined) body.characterName = patch.characterName
  if (patch.avatar !== undefined) body.avatar = patch.avatar
  if (patch.currentTopicId !== undefined) body.currentTopicId = patch.currentTopicId
  if (patch.locale !== undefined) body.locale = patch.locale

  return body
}

/**
 * The client's payload carries `profileId` and a flat `xpEarned`; the Worker
 * takes identity from the token and the XP on the session record.
 */
function toServerPayload(
  payload: SessionCommitPayload,
): ServerSessionCommitPayload {
  const patch = payload.profile
  const required = (
    key:
      | "xp"
      | "lastPracticeAt"
      | "frozenDays"
      | "careTokens"
      | "sessionsSinceLastToken"
      | "completedSessions"
      | "streakCount"
      | "bestStreak",
  ): number => {
    const value = patch[key]

    if (value === undefined) {
      throw new Error(`The session commit is missing ${key}`)
    }

    return value
  }

  return {
    session: { ...payload.session, xpEarned: payload.xpEarned },
    now: payload.now,
    profile: {
      xp: required("xp"),
      lastPracticeAt: required("lastPracticeAt"),
      frozenDays: required("frozenDays"),
      careTokens: required("careTokens"),
      sessionsSinceLastToken: required("sessionsSinceLastToken"),
      completedSessions: required("completedSessions"),
      streakCount: required("streakCount"),
      bestStreak: required("bestStreak"),
      lastStreakDate: patch.lastStreakDate ?? null,
      ...(patch.lastWakeAt === undefined ? {} : { lastWakeAt: patch.lastWakeAt }),
      ...(patch.lastMonthlyReviewAt === undefined
        ? {}
        : { lastMonthlyReviewAt: patch.lastMonthlyReviewAt }),
    },
    progress: payload.progress,
    introductions: payload.introductions.map((row) => ({
      ...row,
      introducedAt: payload.now,
    })),
    metrics: payload.metrics,
  }
}

/** A unique marker the server uses to apply a metric event once. */
function eventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
