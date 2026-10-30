import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { METRIC_NAMES } from "../../shared/metrics"
import type { MeResponse } from "../../shared/me"
import { startWorker, workerConfig, type RunningWorker } from "./harness"
import { TEST_ENV, createTestKey, mintToken, type TestKey } from "./tokens"

/**
 * Host tier: the six `/v1/me` routes on the real Worker, the real local D1,
 * and real RS256 tokens verified against a local JWKS endpoint. The engine is
 * row-scoped per identity, so every user in this file has its own `oid` and
 * no assertion counts a table as a whole.
 */

/**
 * One commit timestamp for the whole file, so replaying a payload is an exact
 * byte-for-byte replay. It is well inside the server's ±24-hour window.
 */
const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000

// Every database assertion shells out to wrangler; the CLI cost, not the code
// under test, dominates a test's duration.
vi.setConfig({ testTimeout: 60_000 })

/**
 * Content the user routes need. Ids are prefixed so they cannot collide with
 * another host-tier file's fixtures, and the avatars come from the seed.
 */
const USER_SEED = `
INSERT INTO topics (id, title, title_zh, icon, description, description_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('u-t1', 'User topic', '用户主题', '🔤', 'd', 'd', 1, 0, 0, NULL),
  ('u-t2', 'Second topic', '第二主题', '🔤', 'd', 'd', 2, 0, 0, NULL);

INSERT INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('u-p1', 'u-t1', 'Pack 1', '包 1', 1, 0, 0, NULL),
  ('u-p2', 'u-t1', 'Pack 2', '包 2', 2, 0, 0, NULL),
  ('u-p3', 'u-t2', 'Pack 3', '包 3', 1, 0, 0, NULL);

INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES
  ('u-w1', 'u-w1', '/w1/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"I see u-w1.","zh":"我看到 u-w1。"}]', NULL, NULL, 1, '["abstract"]', 0, 0, NULL),
  ('u-w2', 'u-w2', '/w2/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"I see u-w2.","zh":"我看到 u-w2。"}]', NULL, NULL, 1, '["abstract"]', 0, 0, NULL),
  ('u-w3', 'u-w3', '/w3/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"I see u-w3.","zh":"我看到 u-w3。"}]', NULL, NULL, 1, '["abstract"]', 0, 0, NULL);

INSERT INTO pack_words (pack_id, word_id, position) VALUES
  ('u-p1', 'u-w1', 1),
  ('u-p1', 'u-w2', 2),
  ('u-p2', 'u-w3', 1),
  ('u-p3', 'u-w1', 1);
`

interface JwksServer {
  readonly url: string
  close(): Promise<void>
}

function startJwksServer(jwk: unknown): Promise<JwksServer> {
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

let worker: RunningWorker
let jwks: JwksServer
let key: TestKey

const tokens = new Map<string, Promise<string>>()

function token(oid: string): Promise<string> {
  let cached = tokens.get(oid)
  if (cached === undefined) {
    cached = mintToken(key, { oid })
    tokens.set(oid, cached)
  }
  return cached
}

interface Call {
  readonly token?: string
  readonly method?: string
  readonly body?: unknown
  readonly rawBody?: string
  readonly headers?: Record<string, string>
}

async function call(path: string, options: Call = {}): Promise<Response> {
  const headers: Record<string, string> = { ...options.headers }

  if (options.token !== undefined) {
    headers.Authorization = `Bearer ${options.token}`
  }
  if (options.body !== undefined || options.rawBody !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  return fetch(`${worker.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.rawBody ??
      (options.body === undefined ? undefined : JSON.stringify(options.body)),
  })
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

function count(table: string, where: string): number {
  return (
    worker.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`,
    )[0]?.n ?? 0
  )
}

async function createProfile(
  oid: string,
  overrides: Record<string, unknown> = {},
): Promise<MeResponse["profile"]> {
  const response = await call("/v1/me/profile", {
    token: await token(oid),
    method: "POST",
    body: {
      characterName: "Hero",
      avatar: "alex",
      currentTopicId: "u-t1",
      locale: "en",
      now: Date.now(),
      ...overrides,
    },
  })

  if (response.status !== 201) {
    throw new Error(`profile creation failed: ${await response.text()}`)
  }

  return json<MeResponse["profile"]>(response)
}

function commitPayload(overrides: {
  sessionId?: string
  words?: string[]
  introductions?: Array<{
    packId: string
    wordId: string
    introducedAt?: number
  }>
  profile?: Record<string, unknown>
  metrics?: Record<string, number>
} = {}) {
  const now = NOW
  const words = overrides.words ?? ["u-w1"]

  return {
    session: {
      id: overrides.sessionId ?? "session-default",
      kind: "daily",
      localDate: "2026-10-30",
      contentVersion: "0.3.0",
      xpEarned: 7,
      finishedAt: now,
    },
    now,
    profile: {
      xp: 7,
      lastPracticeAt: now,
      lastWakeAt: null,
      frozenDays: 0,
      careTokens: 0,
      sessionsSinceLastToken: 1,
      completedSessions: 1,
      streakCount: 1,
      bestStreak: 1,
      lastStreakDate: "2026-10-30",
      lastMonthlyReviewAt: null,
      ...overrides.profile,
    },
    progress: words.map((wordId) => ({
      wordId,
      status: "learning",
      strength: 0.4,
      nextReviewAt: now + DAY,
      correctCount: 1,
      wrongCount: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      masteryXpAwarded: false,
    })),
    introductions: (
      overrides.introductions ??
      words.map((wordId) => ({ packId: "u-p1", wordId, introducedAt: now }))
    ).map((row) => ({ ...row, introducedAt: row.introducedAt ?? now })),
    metrics: overrides.metrics ?? { [METRIC_NAMES.sessionCompleted]: 1 },
  }
}

beforeAll(async () => {
  key = await createTestKey()
  jwks = await startJwksServer(key.jwk)

  try {
    worker = await startWorker(
      workerConfig,
      { ...TEST_ENV, JWKS_URL: jwks.url },
      { migrate: true, seed: USER_SEED },
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

describe("authorization", () => {
  it("answers 401 to every /v1/me route without a token", async () => {
    const routes: Array<[string, string]> = [
      ["GET", "/v1/me"],
      ["POST", "/v1/me/profile"],
      ["PATCH", "/v1/me/profile"],
      ["POST", "/v1/me/sessions"],
      ["POST", "/v1/me/metrics"],
      ["POST", "/v1/me/care"],
    ]

    for (const [method, path] of routes) {
      const response = await call(path, {
        method,
        body: method === "GET" ? undefined : {},
      })
      const body = await json<{ error: { code: string } }>(response)

      expect(response.status, path).toBe(401)
      expect(body.error.code).toBe("unauthorized")
      expect(response.headers.get("www-authenticate")).toBe("Bearer")
    }
  })

  it("answers 200 to GET /v1/me for a freshly minted identity", async () => {
    const response = await call("/v1/me", { token: await token("user-fresh") })
    const body = await json<MeResponse>(response)

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(body).toEqual({
      profile: null,
      progress: [],
      metrics: [],
      introductions: [],
    })
    expect(count("users", "oid = 'user-fresh'")).toBe(1)
  })
})

describe("profile creation", () => {
  it("creates the profile with every Mission 1 default and seeds metrics", async () => {
    const oid = "user-create"
    const now = Date.now()
    const response = await call("/v1/me/profile", {
      token: await token(oid),
      method: "POST",
      body: {
        characterName: "  Mila  ",
        avatar: "alex",
        locale: "zh",
        now,
      },
    })
    const profile = await json<MeResponse["profile"]>(response)

    expect(response.status).toBe(201)
    expect(profile).toMatchObject({
      name: "Mila",
      characterName: "Mila",
      avatar: "alex",
      currentTopicId: null,
      xp: 0,
      createdAt: now,
      lastPracticeAt: now,
      lastWakeAt: null,
      frozenDays: 0,
      careTokens: 0,
      sessionsSinceLastToken: 0,
      completedSessions: 0,
      streakCount: 0,
      bestStreak: 0,
      lastStreakDate: null,
      lastMonthlyReviewAt: null,
      locale: "zh",
    })

    expect(count("profiles", "user_id = 'user-create'")).toBe(1)
    expect(count("metrics", "user_id = 'user-create'")).toBe(14)
  })

  it("returns the existing profile and applies nothing on a second create", async () => {
    const oid = "user-create"
    const first = await call("/v1/me", { token: await token(oid) })
    const before = await json<MeResponse>(first)

    const response = await call("/v1/me/profile", {
      token: await token(oid),
      method: "POST",
      body: {
        characterName: "Someone else",
        avatar: "cody",
        locale: "en",
        now: Date.now(),
      },
    })
    const profile = await json<MeResponse["profile"]>(response)

    expect(response.status).toBe(200)
    expect(profile).toEqual(before.profile)
    expect(count("profiles", "user_id = 'user-create'")).toBe(1)
  })

  it("refuses an invalid name, an unknown avatar, and an unknown topic", async () => {
    const tokenValue = await token("user-invalid")

    for (const body of [
      { characterName: "", avatar: "alex", locale: "en" },
      { characterName: "Mila", avatar: "no-such-avatar", locale: "en" },
      {
        characterName: "Mila",
        avatar: "alex",
        currentTopicId: "no-such-topic",
        locale: "en",
      },
      { characterName: "Mila", avatar: "alex", locale: "fr" },
    ]) {
      const response = await call("/v1/me/profile", {
        token: tokenValue,
        method: "POST",
        body: { ...body, now: Date.now() },
      })
      const error = await json<{ error: { code: string } }>(response)

      expect(response.status).toBe(422)
      expect(error.error.code).toBe("validation_failed")
    }

    expect(count("profiles", "user_id = 'user-invalid'")).toBe(0)
  })

  it("refuses a body that names another identity", async () => {
    const response = await call("/v1/me/profile", {
      token: await token("user-smuggle"),
      method: "POST",
      body: {
        characterName: "Mila",
        avatar: "alex",
        locale: "en",
        now: Date.now(),
        oid: "user-victim",
      },
    })

    expect(response.status).toBe(422)
    expect(count("profiles", "user_id = 'user-smuggle'")).toBe(0)
    expect(count("profiles", "user_id = 'user-victim'")).toBe(0)
  })
})

describe("profile patch", () => {
  it("answers 404 before a profile exists", async () => {
    const response = await call("/v1/me/profile", {
      token: await token("user-no-profile"),
      method: "PATCH",
      body: { avatar: "cody" },
    })

    expect(response.status).toBe(404)
    expect(await json<{ error: { code: string } }>(response)).toMatchObject({
      error: { code: "profile_not_found" },
    })
  })

  it("updates only the allowed fields", async () => {
    const oid = "user-patch"
    await createProfile(oid)

    const response = await call("/v1/me/profile", {
      token: await token(oid),
      method: "PATCH",
      body: {
        characterName: "New name",
        avatar: "cody",
        currentTopicId: null,
        locale: "zh",
      },
    })
    const profile = await json<MeResponse["profile"]>(response)

    expect(response.status).toBe(200)
    expect(profile).toMatchObject({
      name: "New name",
      characterName: "New name",
      avatar: "cody",
      currentTopicId: null,
      locale: "zh",
    })
  })

  it("refuses a server-owned field and changes nothing", async () => {
    const oid = "user-patch-guard"
    const created = await createProfile(oid)

    const response = await call("/v1/me/profile", {
      token: await token(oid),
      method: "PATCH",
      body: { xp: 999 },
    })

    expect(response.status).toBe(422)
    expect(count("profiles", "user_id = 'user-patch-guard' AND xp = 999")).toBe(
      0,
    )
    expect(
      count("profiles", `user_id = 'user-patch-guard' AND xp = ${created?.xp}`),
    ).toBe(1)
  })

  it("rejects an avatar that is not in D1", async () => {
    const oid = "user-patch-avatar"
    await createProfile(oid)

    const response = await call("/v1/me/profile", {
      token: await token(oid),
      method: "PATCH",
      body: { avatar: "no-such-avatar" },
    })

    expect(response.status).toBe(422)
    expect(
      count(
        "profiles",
        "user_id = 'user-patch-avatar' AND avatar = 'no-such-avatar'",
      ),
    ).toBe(0)
  })
})

describe("session commit", () => {
  it("answers 404 before the profile exists", async () => {
    const response = await call("/v1/me/sessions", {
      token: await token("user-session-noprofile"),
      method: "POST",
      body: commitPayload(),
    })

    expect(response.status).toBe(404)
    expect(
      count("sessions", "user_id = 'user-session-noprofile'"),
    ).toBe(0)
  })

  it("writes the session, profile, progress, introductions, and counters in one batch", async () => {
    const oid = "user-session"
    await createProfile(oid)
    const payload = commitPayload({
      sessionId: "session-first",
      words: ["u-w1", "u-w2"],
      metrics: {
        [METRIC_NAMES.sessionCompleted]: 1,
        [METRIC_NAMES.xpEarned]: 7,
      },
    })

    const response = await call("/v1/me/sessions", {
      token: await token(oid),
      method: "POST",
      body: payload,
    })
    const me = await json<MeResponse>(response)

    expect(response.status).toBe(200)
    expect(me.profile?.xp).toBe(7)
    expect(me.profile?.completedSessions).toBe(1)
    expect(me.progress.map((row) => row.wordId)).toEqual(["u-w1", "u-w2"])
    expect(me.introductions).toHaveLength(2)
    expect(
      me.metrics.find((metric) => metric.name === METRIC_NAMES.sessionCompleted)
        ?.value,
    ).toBe(1)
    expect(
      me.metrics.find((metric) => metric.name === METRIC_NAMES.xpEarned)?.value,
    ).toBe(7)

    expect(count("sessions", "user_id = 'user-session' AND id = 'session-first'")).toBe(1)
    expect(count("session_metrics", "user_id = 'user-session' AND session_id = 'session-first'")).toBe(2)
  })

  it("replays the identical payload without counting anything twice", async () => {
    const oid = "user-session"
    const payload = commitPayload({
      sessionId: "session-first",
      words: ["u-w1", "u-w2"],
      metrics: {
        [METRIC_NAMES.sessionCompleted]: 1,
        [METRIC_NAMES.xpEarned]: 7,
      },
    })

    const before = await json<MeResponse>(
      await call("/v1/me", { token: await token(oid) }),
    )

    const response = await call("/v1/me/sessions", {
      token: await token(oid),
      method: "POST",
      body: payload,
    })
    const after = await json<MeResponse>(response)

    expect(response.status).toBe(200)
    expect(after).toEqual(before)
    expect(count("sessions", "user_id = 'user-session'")).toBe(1)
    expect(
      count("pack_introductions", "user_id = 'user-session'"),
    ).toBe(2)
  })

  it("refuses an unknown word before writing the session", async () => {
    const oid = "user-session-unknown-word"
    await createProfile(oid)

    const response = await call("/v1/me/sessions", {
      token: await token(oid),
      method: "POST",
      body: commitPayload({ sessionId: "session-unknown-word", words: ["u-missing"] }),
    })

    expect(response.status).toBe(422)
    expect(await json<{ error: { code: string } }>(response)).toMatchObject({
      error: { code: "unknown_word" },
    })
    expect(
      count(
        "sessions",
        "user_id = 'user-session-unknown-word' AND id = 'session-unknown-word'",
      ),
    ).toBe(0)
  })

  it("refuses a pack-word pair that is not in pack_words", async () => {
    const oid = "user-session-unknown-pair"
    await createProfile(oid)

    const response = await call("/v1/me/sessions", {
      token: await token(oid),
      method: "POST",
      body: commitPayload({
        sessionId: "session-unknown-pair",
        words: ["u-w3"],
        introductions: [{ packId: "u-p1", wordId: "u-w3" }],
      }),
    })

    const text = await response.clone().text()
    expect(response.status, text).toBe(422)
    expect(await json<{ error: { code: string } }>(response), text).toMatchObject({
      error: { code: "unknown_pack_word" },
    })
    expect(
      count(
        "sessions",
        "user_id = 'user-session-unknown-pair' AND id = 'session-unknown-pair'",
      ),
    ).toBe(0)
  })

  it("refuses a clock outside the 24-hour window", async () => {
    const oid = "user-session-clock"
    await createProfile(oid)
    const payload = commitPayload({ sessionId: "session-clock" })
    payload.now = Date.now() + 2 * DAY
    payload.session.finishedAt = payload.now

    const response = await call("/v1/me/sessions", {
      token: await token(oid),
      method: "POST",
      body: payload,
    })

    expect(response.status).toBe(422)
    expect(await json<{ error: { code: string } }>(response)).toMatchObject({
      error: { code: "clock_out_of_range" },
    })
    expect(
      count("sessions", "user_id = 'user-session-clock'"),
    ).toBe(0)
  })

  it("records one word introduced in two packs as two introductions and one progress row", async () => {
    const oid = "user-session-two-packs"
    await createProfile(oid)

    const response = await call("/v1/me/sessions", {
      token: await token(oid),
      method: "POST",
      body: commitPayload({
        sessionId: "session-two-packs",
        words: ["u-w1"],
        introductions: [
          { packId: "u-p1", wordId: "u-w1" },
          { packId: "u-p3", wordId: "u-w1" },
        ],
      }),
    })
    const text = await response.clone().text()
    const me = await json<MeResponse>(response)

    expect(response.status, text).toBe(200)
    expect(me.introductions.map((row) => row.packId).sort()).toEqual([
      "u-p1",
      "u-p3",
    ])
    expect(count("progress", "user_id = 'user-session-two-packs'")).toBe(1)
  })

  it("writes to the token's identity even when the body names another", async () => {
    const oid = "user-session-owner"
    await createProfile(oid)

    const response = await call("/v1/me/sessions", {
      token: await token(oid),
      method: "POST",
      body: {
        ...commitPayload({ sessionId: "session-owner" }),
        oid: "user-victim",
        profileId: 42,
      },
    })

    expect(response.status).toBe(200)
    expect(
      count("sessions", "user_id = 'user-session-owner' AND id = 'session-owner'"),
    ).toBe(1)
    expect(
      count("sessions", "user_id = 'user-victim'"),
    ).toBe(0)
  })

  it("rolls the whole batch back when one statement fails", async () => {
    const oid = "user-session-atomic"
    const created = await createProfile(oid)

    worker.query(
      `CREATE TRIGGER u_fail_progress BEFORE INSERT ON progress
         WHEN NEW.user_id = 'user-session-atomic' AND NEW.word_id = 'u-w2'
         BEGIN SELECT RAISE(ABORT, 'forced failure'); END;`,
    )

    try {
      const response = await call("/v1/me/sessions", {
        token: await token(oid),
        method: "POST",
        body: commitPayload({
          sessionId: "session-atomic",
          words: ["u-w1", "u-w2"],
          introductions: [{ packId: "u-p1", wordId: "u-w1" }],
          metrics: { [METRIC_NAMES.sessionCompleted]: 1 },
        }),
      })

      expect(response.status).toBe(500)

      expect(
        count(
          "sessions",
          "user_id = 'user-session-atomic' AND id = 'session-atomic'",
        ),
      ).toBe(0)
      expect(count("progress", "user_id = 'user-session-atomic'")).toBe(0)
      expect(
        count("pack_introductions", "user_id = 'user-session-atomic'"),
      ).toBe(0)
      expect(
        count("session_metrics", "user_id = 'user-session-atomic'"),
      ).toBe(0)
      expect(
        count(
          "profiles",
          `user_id = 'user-session-atomic' AND xp = ${created?.xp}`,
        ),
      ).toBe(1)
      expect(
        count(
          "metrics",
          `user_id = 'user-session-atomic' AND name = '${METRIC_NAMES.sessionCompleted}' AND value = 0`,
        ),
      ).toBe(1)
    } finally {
      worker.query("DROP TRIGGER IF EXISTS u_fail_progress")
    }
  }, 60_000)
})

describe("metric writes", () => {
  it("adds the delta once and returns the current value on replay", async () => {
    const oid = "user-metric"
    await createProfile(oid)
    const body = {
      name: METRIC_NAMES.collectionOpened,
      delta: 2,
      eventId: "metric-event-1",
    }

    const first = await call("/v1/me/metrics", {
      token: await token(oid),
      method: "POST",
      body,
    })
    expect(first.status).toBe(200)
    expect(await json(first)).toMatchObject({ name: METRIC_NAMES.collectionOpened, value: 2 })

    const replay = await call("/v1/me/metrics", {
      token: await token(oid),
      method: "POST",
      body,
    })
    expect(replay.status).toBe(200)
    expect(await json(replay)).toMatchObject({ value: 2 })
    expect(count("metric_events", "user_id = 'user-metric'")).toBe(1)
  })

  it("refuses an unknown metric and a negative unsigned delta", async () => {
    const oid = "user-metric-invalid"
    await createProfile(oid)

    for (const body of [
      { name: "made.up", delta: 1, eventId: "bad-1" },
      { name: METRIC_NAMES.wordLearned, delta: -1, eventId: "bad-2" },
    ]) {
      const response = await call("/v1/me/metrics", {
        token: await token(oid),
        method: "POST",
        body,
      })

      expect(response.status).toBe(422)
    }

    expect(count("metric_events", "user_id = 'user-metric-invalid'")).toBe(0)
  })
})

describe("care writes", () => {
  it("answers 404 before a profile exists", async () => {
    const response = await call("/v1/me/care", {
      token: await token("user-care-noprofile"),
      method: "POST",
      body: { action: "freeze", eventId: "care-1" },
    })

    expect(response.status).toBe(404)
  })

  it("refuses care that cannot be afforded before writing anything", async () => {
    const oid = "user-care-empty"
    await createProfile(oid)

    const response = await call("/v1/me/care", {
      token: await token(oid),
      method: "POST",
      body: { action: "freeze", eventId: "care-empty-1" },
    })

    expect(response.status).toBe(409)
    expect(await json<{ error: { code: string } }>(response)).toMatchObject({
      error: { code: "care_unavailable" },
    })
    expect(count("metric_events", "user_id = 'user-care-empty'")).toBe(0)
    expect(
      count("profiles", "user_id = 'user-care-empty' AND frozen_days = 0"),
    ).toBe(1)
  })

  it("spends exactly one token on freeze and does not spend again on replay", async () => {
    const oid = "user-care-freeze"
    await createProfile(oid)
    worker.query(
      "UPDATE profiles SET care_tokens = 1 WHERE user_id = 'user-care-freeze'",
    )

    const body = { action: "freeze", eventId: "care-freeze-1" }
    const first = await call("/v1/me/care", {
      token: await token(oid),
      method: "POST",
      body,
    })
    const profile = await json<{ profile: MeResponse["profile"] }>(first)

    expect(first.status).toBe(200)
    expect(profile.profile?.careTokens).toBe(0)
    expect(profile.profile?.frozenDays).toBe(1)

    const replay = await call("/v1/me/care", {
      token: await token(oid),
      method: "POST",
      body,
    })
    const replayed = await json<{ profile: MeResponse["profile"] }>(replay)

    expect(replay.status).toBe(200)
    expect(replayed.profile?.careTokens).toBe(0)
    expect(replayed.profile?.frozenDays).toBe(1)
    expect(count("metric_events", "user_id = 'user-care-freeze'")).toBe(1)
  })

  it("quick-wakes a sleeping character and counts the revival metric once", async () => {
    const oid = "user-care-wake"
    await createProfile(oid)
    const tenDaysAgo = Date.now() - 10 * DAY
    worker.query(
      `UPDATE profiles
          SET care_tokens = 1, created_at = ${tenDaysAgo},
              last_practice_at = ${tenDaysAgo}, last_wake_at = NULL
        WHERE user_id = 'user-care-wake'`,
    )

    const body = { action: "quickWake", eventId: "care-wake-1" }
    const first = await call("/v1/me/care", {
      token: await token(oid),
      method: "POST",
      body,
    })
    const profile = await json<{ profile: MeResponse["profile"] }>(first)

    expect(first.status).toBe(200)
    expect(profile.profile?.careTokens).toBe(0)
    expect(profile.profile?.lastWakeAt).toBeGreaterThan(tenDaysAgo)
    expect(profile.profile?.frozenDays).toBe(0)
    expect(
      count(
        "metrics",
        `user_id = 'user-care-wake' AND name = '${METRIC_NAMES.revivalQuickWake}' AND value = 1`,
      ),
    ).toBe(1)

    const replay = await call("/v1/me/care", {
      token: await token(oid),
      method: "POST",
      body,
    })

    expect(replay.status).toBe(200)
    expect(
      count(
        "metrics",
        `user_id = 'user-care-wake' AND name = '${METRIC_NAMES.revivalQuickWake}' AND value = 1`,
      ),
    ).toBe(1)
  })

  it("refuses a quick wake while the character is awake", async () => {
    const oid = "user-care-awake"
    await createProfile(oid)
    worker.query(
      "UPDATE profiles SET care_tokens = 1 WHERE user_id = 'user-care-awake'",
    )

    const response = await call("/v1/me/care", {
      token: await token(oid),
      method: "POST",
      body: { action: "quickWake", eventId: "care-awake-1" },
    })

    expect(response.status).toBe(409)
    expect(count("metric_events", "user_id = 'user-care-awake'")).toBe(0)
  })
})

describe("cross-user isolation", () => {
  it("never returns another identity's rows", async () => {
    const owner = "user-owner"
    const stranger = "user-stranger"
    await createProfile(owner)
    await createProfile(stranger)

    await call("/v1/me/sessions", {
      token: await token(owner),
      method: "POST",
      body: commitPayload({ sessionId: "owner-session", words: ["u-w1"] }),
    })

    const own = await json<MeResponse>(
      await call("/v1/me", { token: await token(owner) }),
    )
    const other = await json<MeResponse>(
      await call("/v1/me", { token: await token(stranger) }),
    )

    expect(own.profile?.xp).toBe(7)
    expect(own.progress).toHaveLength(1)
    expect(other.profile?.xp).toBe(0)
    expect(other.progress).toEqual([])
    expect(other.introductions).toEqual([])
  })
})

describe("request guards", () => {
  it("refuses a body over 64 KB before writing", async () => {
    const oid = "user-oversized"
    await createProfile(oid)

    const response = await call("/v1/me/profile", {
      token: await token(oid),
      method: "PATCH",
      rawBody: JSON.stringify({ characterName: "a".repeat(70 * 1024) }),
    })

    expect(response.status).toBe(422)
    expect(
      count("profiles", "user_id = 'user-oversized'"),
    ).toBe(1)
  })

  it("reports invalid JSON as invalid_json", async () => {
    const response = await call("/v1/me/profile", {
      token: await token("user-bad-json"),
      method: "POST",
      rawBody: "{not json",
    })

    expect(response.status).toBe(400)
    expect(await json<{ error: { code: string } }>(response)).toMatchObject({
      error: { code: "invalid_json" },
    })
  })
})
