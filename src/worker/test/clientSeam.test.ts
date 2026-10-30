import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { METRIC_NAMES } from "../../shared/metrics"
import type { SessionCommitPayload } from "../../shared/provider"
import { buildSession, sessionSeed } from "../../shared/session"
import { ApiProgressProvider } from "../../page/api/ApiProgressProvider"
import { createApiClient } from "../../page/api/client"
import { fetchContent } from "../../page/api/content"
import { Outbox, type StorageLike } from "../../page/api/outbox"
import { startWorker, workerConfig, type RunningWorker } from "./harness"
import { TEST_ENV, createTestKey, mintToken, type TestKey } from "./tokens"

/**
 * Host / seam tier: the real client modules against the real Worker and D1.
 *
 * This is the only run that drives request → provider → engine end to end, so
 * it covers the wiring the unit tiers deliberately leave out: the token the
 * client sends is the token the Worker verifies, the payload the provider
 * shapes is the payload the Worker stores, and the introductions the Worker
 * returns are what unlock the next pack.
 */

const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000

vi.setConfig({ testTimeout: 60_000 })

const SEAM_SEED = `
INSERT INTO topics (id, title, title_zh, icon, description, description_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('seam-t1', 'Seam topic', '接缝主题', '🔤', 'd', 'd', 1, 0, 0, NULL);

INSERT INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('seam-p1', 'seam-t1', 'Pack 1', '包 1', 1, 0, 0, NULL),
  ('seam-p2', 'seam-t1', 'Pack 2', '包 2', 2, 0, 0, NULL);

INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES
  ('seam-w1', 'seam-w1', '/w1/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"I see seam-w1.","zh":"我看到 seam-w1。"}]', NULL, NULL, 1, '["abstract"]', 0, 0, NULL),
  ('seam-w2', 'seam-w2', '/w2/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"I see seam-w2.","zh":"我看到 seam-w2。"}]', NULL, NULL, 1, '["abstract"]', 0, 0, NULL),
  ('seam-w3', 'seam-w3', '/w3/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"I see seam-w3.","zh":"我看到 seam-w3。"}]', NULL, NULL, 1, '["abstract"]', 0, 0, NULL);

INSERT INTO pack_words (pack_id, word_id, position) VALUES
  ('seam-p1', 'seam-w1', 1),
  ('seam-p1', 'seam-w2', 2),
  ('seam-p2', 'seam-w3', 1);
`

function startJwksServer(jwk: unknown): Promise<{ url: string; close(): Promise<void> }> {
  return new Promise((resolve) => {
    const server: Server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ keys: [jwk] }))
    })

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo

      resolve({
        url: `http://127.0.0.1:${address.port}/jwks`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done())
          }),
      })
    })
  })
}

/** The outbox and device flags live in memory; no browser is running. */
class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

let worker: RunningWorker
let jwks: { url: string; close(): Promise<void> }
let key: TestKey

const OID = "seam-user"

function payload(
  sessionId: string,
  overrides: Partial<SessionCommitPayload> = {},
): SessionCommitPayload {
  return {
    profileId: OID,
    now: NOW,
    xpEarned: 7,
    session: {
      id: sessionId,
      kind: "daily",
      localDate: "2026-10-30",
      contentVersion: "seam-1",
      finishedAt: NOW,
    },
    profile: {
      xp: 7,
      lastPracticeAt: NOW,
      frozenDays: 0,
      careTokens: 0,
      sessionsSinceLastToken: 1,
      completedSessions: 1,
      streakCount: 1,
      bestStreak: 1,
      lastStreakDate: "2026-10-30",
    },
    progress: [],
    introductions: [],
    metrics: { [METRIC_NAMES.sessionCompleted]: 1 },
    ...overrides,
  }
}

beforeAll(async () => {
  key = await createTestKey()
  jwks = await startJwksServer(key.jwk)

  try {
    worker = await startWorker(
      workerConfig,
      { ...TEST_ENV, JWKS_URL: jwks.url },
      { migrate: true, seed: SEAM_SEED },
    )
  } catch (error) {
    await jwks.close()
    throw error
  }
}, 180_000)

afterAll(async () => {
  await worker?.stop()
  await jwks?.close()
})

describe("client → Worker → D1", () => {
  it("creates a profile, commits, replays the outbox, and unlocks the next pack", async () => {
    const token = await mintToken(key, { oid: OID })
    const client = createApiClient({
      baseUrl: worker.baseUrl,
      getToken: async () => token,
      onUnauthorized: () => {
        throw new Error("unexpected 401 in the seam test")
      },
    })
    const storage = new MemoryStorage()
    // A separate key from the one provider uses, so the assertions are about
    // this test's outbox only.
    const outbox = new Outbox(storage, "seam-outbox")
    const provider = new ApiProgressProvider({
      client,
      identity: () => OID,
      outbox,
      storage,
      now: () => NOW,
    })

    // Boot: content and the profile arrive from the real routes.
    const [bundle, fresh] = await Promise.all([
      fetchContent(client),
      provider.refresh(),
    ])

    expect(fresh).toBeNull()
    expect(bundle.meta.contentVersion).not.toBe("")

    const profile = await provider.createProfile({
      ...emptyProfile(),
      characterName: "Seam",
      avatar: "alex",
      currentTopicId: "seam-t1",
    })

    expect(profile.id).toBe(OID)
    expect(profile.currentTopicId).toBe("seam-t1")

    // The builder selects the first pack's two words and says they are new.
    const plan = buildSession({
      profile,
      progress: [],
      packs: bundle.packs,
      words: bundle.words,
      now: NOW,
      seed: sessionSeed(OID, NOW, "daily", bundle.meta.contentVersion),
      speechAvailable: false,
      introductions: [],
    })

    expect(plan.introductions).toEqual([
      { packId: "seam-p1", wordId: "seam-w1" },
      { packId: "seam-p1", wordId: "seam-w2" },
    ])

    const first = payload("seam-s1", {
      progress: plan.introductions.map((row) => ({
        wordId: row.wordId,
        status: "learning",
        strength: 0.4,
        nextReviewAt: NOW + DAY,
        correctCount: 1,
        wrongCount: 0,
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        masteryXpAwarded: false,
      })),
      introductions: plan.introductions,
    })

    await expect(provider.commitSession(first)).resolves.toBe("saved")

    // A queued commit is drained on the next boot. The provider is the only
    // sender, so this also proves the stored payload keeps its shape.
    const second = payload("seam-s2", {
      profile: {
        ...payload("seam-s2").profile,
        xp: 14,
        completedSessions: 2,
        lastStreakDate: "2026-10-30",
      },
      metrics: {},
    })

    outbox.enqueue(second, NOW)
    expect(outbox.all()).toHaveLength(1)

    await expect(
      outbox.drain((stored) => provider.sendCommit(stored).then(() => undefined)),
    ).resolves.toEqual({
      sent: ["seam-s2"],
      dropped: [],
      remaining: [],
      unauthorized: false,
    })
    expect(outbox.all()).toEqual([])

    // Re-read the server state through the provider, then through the raw route.
    await provider.refresh()
    const introductions = await provider.getIntroductions(OID)
    const serverProfile = await provider.getProfile()

    expect(serverProfile?.completedSessions).toBe(2)
    expect(introductions).toHaveLength(2)

    const me = await client.request<{
      progress: unknown[]
      introductions: unknown[]
    }>("/v1/me")

    expect(me.progress).toHaveLength(2)
    expect(me.introductions).toHaveLength(2)

    // The introductions the Worker returned unlock pack 2. The next day, so
    // the words learned today do not turn the session into repeat practice.
    const tomorrow = NOW + DAY
    const next = buildSession({
      profile,
      progress: await provider.getAllProgress(OID),
      packs: bundle.packs,
      words: bundle.words,
      now: tomorrow,
      seed: sessionSeed(OID, tomorrow, "daily", bundle.meta.contentVersion),
      speechAvailable: false,
      introductions,
    })

    expect(next.words.find((word) => word.kind === "new")).toMatchObject({
      wordId: "seam-w3",
      packId: "seam-p2",
    })

    // A replay of the drained commit is idempotent.
    await expect(provider.commitSession(second)).resolves.toBe("saved")
    await provider.refresh()

    expect(await provider.getAllProgress(OID)).toHaveLength(2)
    expect(await provider.getIntroductions(OID)).toHaveLength(2)
    await expect(
      client.request<{ introductions: unknown[] }>("/v1/me"),
    ).resolves.toMatchObject({ profile: { completedSessions: 2 } })
  })
})

/** Every field the provider's NewProfile type needs; the Worker fills these. */
function emptyProfile() {
  return {
    name: "Seam",
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
    locale: "en" as const,
  }
}
