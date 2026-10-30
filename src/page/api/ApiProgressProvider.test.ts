import { describe, expect, it, vi } from "vitest"

import { DEVICE_KEYS } from "@shared/device"
import type { MeResponse, ServerProfile } from "@shared/me"
import { METRIC_NAMES } from "@shared/metrics"
import type { SessionCommitPayload } from "@shared/provider"

import {
  ApiProgressProvider,
  type ApiProgressProviderOptions,
} from "./ApiProgressProvider"
import { ApiError, type ApiClient, type ApiRequestOptions } from "./client"
import { Outbox, type StorageLike } from "./outbox"

const NOW = 1_760_000_000_000
const DAY = 86_400_000

function memoryStorage(): StorageLike {
  const raw = new Map<string, string>()

  return {
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => {
      raw.set(key, value)
    },
    removeItem: (key) => {
      raw.delete(key)
    },
  }
}

function serverProfile(overrides: Partial<ServerProfile> = {}): ServerProfile {
  return {
    name: "Mia",
    characterName: "Mia",
    avatar: "alex",
    currentTopicId: null,
    xp: 100,
    createdAt: NOW,
    lastPracticeAt: NOW,
    lastWakeAt: null,
    frozenDays: 0,
    careTokens: 1,
    sessionsSinceLastToken: 2,
    completedSessions: 3,
    streakCount: 4,
    bestStreak: 5,
    lastStreakDate: "2026-10-30",
    lastMonthlyReviewAt: null,
    locale: "en",
    ...overrides,
  }
}

function me(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    profile: serverProfile(),
    progress: [
      {
        wordId: "w-1",
        status: "learning",
        strength: 0.4,
        nextReviewAt: NOW + DAY,
        correctCount: 1,
        wrongCount: 0,
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        masteryXpAwarded: false,
      },
    ],
    metrics: [
      { name: METRIC_NAMES.sessionCompleted, value: 3, updatedAt: NOW },
    ],
    introductions: [{ packId: "p-1", wordId: "w-1", introducedAt: NOW }],
    ...overrides,
  }
}

function commitPayload(): SessionCommitPayload {
  return {
    profileId: "oid-1",
    now: NOW,
    session: {
      id: "session-1",
      kind: "daily",
      localDate: "2026-10-30",
      contentVersion: "v1",
      finishedAt: NOW,
    },
    xpEarned: 12,
    profile: {
      xp: 112,
      completedSessions: 4,
      lastPracticeAt: NOW,
      frozenDays: 0,
      careTokens: 1,
      sessionsSinceLastToken: 3,
      streakCount: 4,
      bestStreak: 5,
      lastStreakDate: "2026-10-30",
    },
    progress: [
      {
        wordId: "w-1",
        status: "learning",
        strength: 0.6,
        nextReviewAt: NOW + DAY,
        correctCount: 2,
        wrongCount: 0,
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        masteryXpAwarded: false,
      },
    ],
    introductions: [{ packId: "p-1", wordId: "w-1" }],
    metrics: { [METRIC_NAMES.sessionCompleted]: 1 },
  }
}

type Handler = (options: ApiRequestOptions) => unknown

function fakeClient(
  routes: Record<string, Handler>,
): ApiClient & { request: ReturnType<typeof vi.fn> } {
  const request = vi.fn(
    async (path: string, options: ApiRequestOptions = {}) => {
      const handler = routes[`${options.method ?? "GET"} ${path}`]

      if (handler === undefined) {
        throw new Error(`unexpected request: ${options.method ?? "GET"} ${path}`)
      }

      return handler(options)
    },
  )

  return { request: request as unknown as ApiClient["request"] } as ApiClient & {
    request: ReturnType<typeof vi.fn>
  }
}

function makeProvider(
  routes: Record<string, Handler>,
  overrides: Partial<ApiProgressProviderOptions> = {},
) {
  const client = fakeClient(routes)
  const outbox = new Outbox(memoryStorage())
  const provider = new ApiProgressProvider({
    client,
    identity: () => "oid-1",
    outbox,
    storage: memoryStorage(),
    now: () => NOW,
    ...overrides,
  })

  return { client, outbox, provider }
}

describe("ApiProgressProvider", () => {
  it("maps the snapshot with the token's oid as the profile id", async () => {
    const { provider } = makeProvider({ "GET /v1/me": () => me() })

    const profile = await provider.getProfile()

    expect(profile).toMatchObject({ id: "oid-1", characterName: "Mia" })
    await expect(provider.getAllProgress("oid-1")).resolves.toEqual([
      expect.objectContaining({ profileId: "oid-1", wordId: "w-1" }),
    ])
    await expect(provider.getIntroductions("oid-1")).resolves.toEqual([
      { packId: "p-1", wordId: "w-1", introducedAt: NOW },
    ])
    await expect(provider.getMetrics("oid-1")).resolves.toEqual([
      {
        profileId: "oid-1",
        name: METRIC_NAMES.sessionCompleted,
        value: 3,
        updatedAt: NOW,
      },
    ])
  })

  it("returns null before a profile exists", async () => {
    const { provider } = makeProvider({
      "GET /v1/me": () => me({ profile: null }),
    })

    await expect(provider.getProfile()).resolves.toBeNull()
  })

  it("creates a profile through the API and refreshes", async () => {
    let created = false
    const { client, provider } = makeProvider({
      "POST /v1/me/profile": () => {
        created = true
        return serverProfile({ characterName: "Leo", avatar: "cody" })
      },
      "GET /v1/me": () =>
        created
          ? me({ profile: serverProfile({ characterName: "Leo", avatar: "cody" }) })
          : me({ profile: null }),
    })

    const profile = await provider.createProfile({
      name: "Leo",
      characterName: "Leo",
      avatar: "cody",
      currentTopicId: null,
      xp: 0,
      createdAt: NOW,
      lastPracticeAt: NOW,
      lastWakeAt: null,
      frozenDays: 0,
      careTokens: 0,
      sessionsSinceLastToken: 0,
      completedSessions: 0,
      streakCount: 0,
      bestStreak: 0,
      lastStreakDate: null,
      lastMonthlyReviewAt: null,
      locale: "en",
    })

    expect(profile).toMatchObject({ id: "oid-1", characterName: "Leo" })
    expect(client.request).toHaveBeenCalledWith("/v1/me/profile", {
      method: "POST",
      body: {
        characterName: "Leo",
        avatar: "cody",
        currentTopicId: null,
        locale: "en",
        now: NOW,
      },
    })
    expect(client.request).toHaveBeenCalledWith("/v1/me")
  })

  it("patches only the fields a screen may change", async () => {
    const { client, provider } = makeProvider({
      "GET /v1/me": () => me(),
      "PATCH /v1/me/profile": () => serverProfile({ locale: "zh" }),
    })

    await provider.getProfile()
    await provider.updateProfile("oid-1", {
      locale: "zh",
      xp: 999,
      characterName: "Mia",
    })

    expect(client.request).toHaveBeenCalledWith("/v1/me/profile", {
      method: "PATCH",
      body: { characterName: "Mia", locale: "zh" },
    })
    await expect(provider.getProfile()).resolves.toMatchObject({ locale: "zh" })
  })

  it("maps a client commit onto the server payload and returns saved", async () => {
    const { client, outbox, provider } = makeProvider({
      "GET /v1/me": () => me(),
      "POST /v1/me/sessions": () => me({ profile: serverProfile({ xp: 112 }) }),
    })

    await provider.getProfile()
    const outcome = await provider.commitSession(commitPayload())

    expect(outcome).toBe("saved")

    const body = client.request.mock.calls[1]?.[1] as ApiRequestOptions
    expect(body.body).toEqual({
      session: {
        id: "session-1",
        kind: "daily",
        localDate: "2026-10-30",
        contentVersion: "v1",
        xpEarned: 12,
        finishedAt: NOW,
      },
      now: NOW,
      profile: {
        xp: 112,
        lastPracticeAt: NOW,
        frozenDays: 0,
        careTokens: 1,
        sessionsSinceLastToken: 3,
        completedSessions: 4,
        streakCount: 4,
        bestStreak: 5,
        lastStreakDate: "2026-10-30",
      },
      progress: [
        {
          wordId: "w-1",
          status: "learning",
          strength: 0.6,
          nextReviewAt: NOW + DAY,
          correctCount: 2,
          wrongCount: 0,
          firstSeenAt: NOW,
          lastSeenAt: NOW,
          masteryXpAwarded: false,
        },
      ],
      introductions: [{ packId: "p-1", wordId: "w-1", introducedAt: NOW }],
      metrics: { [METRIC_NAMES.sessionCompleted]: 1 },
    })
    expect(outbox.all()).toEqual([])
    await expect(provider.getProfile()).resolves.toMatchObject({ xp: 112 })
  })

  it("parks a retryable failure in the outbox and reports queued", async () => {
    const { outbox, provider } = makeProvider({
      "GET /v1/me": () => me(),
      "POST /v1/me/sessions": () => {
        throw new ApiError("network", 0)
      },
    })

    await provider.getProfile()

    await expect(provider.commitSession(commitPayload())).resolves.toBe(
      "queued",
    )
    expect(outbox.all()).toEqual([
      { payload: commitPayload(), queuedAt: NOW },
    ])
  })

  it("refuses an invalid payload before any request", async () => {
    const { client, provider } = makeProvider({
      "GET /v1/me": () => me(),
    })
    const invalid = commitPayload()
    invalid.profileId = ""

    await provider.getProfile()
    client.request.mockClear()

    await expect(provider.commitSession(invalid)).rejects.toThrow(
      /profile-id-missing/,
    )
    expect(client.request).not.toHaveBeenCalled()
  })

  it("surfaces a non-retryable commit failure without enqueueing", async () => {
    const { outbox, provider } = makeProvider({
      "GET /v1/me": () => me(),
      "POST /v1/me/sessions": () => {
        throw new ApiError("validation_failed", 422)
      },
    })

    await provider.getProfile()

    await expect(provider.commitSession(commitPayload())).rejects.toMatchObject({
      status: 422,
    })
    expect(outbox.all()).toEqual([])
  })

  it("applies care through the care route with an event id", async () => {
    const { client, provider } = makeProvider({
      "GET /v1/me": () => me(),
      "POST /v1/me/care": () => ({
        profile: serverProfile({ frozenDays: 1, careTokens: 0 }),
      }),
    })

    await provider.getProfile()

    const profile = await provider.applyCare("freeze")

    expect(profile).toMatchObject({ id: "oid-1", frozenDays: 1 })
    expect(client.request).toHaveBeenCalledWith("/v1/me/care", {
      method: "POST",
      body: { action: "freeze", eventId: expect.any(String) },
    })
  })

  it("writes a metric event with a generated id", async () => {
    const { client, provider } = makeProvider({
      "GET /v1/me": () => me(),
      "POST /v1/me/metrics": () => ({
        name: METRIC_NAMES.sessionAbandoned,
        value: 1,
        updatedAt: NOW,
      }),
    })

    await provider.getProfile()
    await provider.incrementMetric("oid-1", METRIC_NAMES.sessionAbandoned)

    expect(client.request).toHaveBeenCalledWith("/v1/me/metrics", {
      method: "POST",
      body: {
        name: METRIC_NAMES.sessionAbandoned,
        delta: 1,
        eventId: expect.any(String),
      },
    })
  })

  it("keeps device flags in local storage and never sends them", async () => {
    const storage = memoryStorage()
    const { client, provider } = makeProvider(
      {},
      { storage },
    )

    await provider.setDevice(DEVICE_KEYS.lastBootAt, NOW)

    await expect(provider.getDevice(DEVICE_KEYS.lastBootAt)).resolves.toBe(NOW)
    expect(client.request).not.toHaveBeenCalled()
  })
})
