import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import {
  badgeFacts,
  deriveBadges,
  newlyEarned,
  topicTrophyId,
} from "../../shared/badges"
import type { ExamResult, TopicExam, TopicExamState } from "../../shared/exam"
import type { MeResponse } from "../../shared/me"
import { startWorker, workerConfig, type RunningWorker } from "./harness"
import { TEST_ENV, createTestKey, mintToken, type TestKey } from "./tokens"

/**
 * Host tier for feature 37: the real Worker and local D1 behind the facts the
 * badge derivation reads. Nothing badge-shaped is stored; the test derives
 * from `/v1/me` and `/v1/me/exams` exactly as the client does.
 */

const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const WORDS = [
  ["x-w1", "alpha"],
  ["x-w2", "bravo"],
  ["x-w3", "charlie"],
  ["x-w4", "delta"],
  ["x-w5", "echo"],
  ["x-w6", "foxtrot"],
  ["x-w7", "golf"],
  ["x-w8", "hotel"],
  ["x-w9", "india"],
  ["x-w10", "juliet"],
] as const

const BADGES_SEED = `
INSERT INTO topics (id, title, title_zh, icon, description, description_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('x-t1', 'Badge topic', '徽章主题', '🏅', 'd', 'd', 1, 0, 0, NULL);

INSERT INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('x-p1', 'x-t1', 'Pack 1', '包 1', 1, 0, 0, NULL);

INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES
${WORDS.map(
  ([id, text]) =>
    `('${id}', '${text}', '/x/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"${text}","zh":"m"}]', NULL, NULL, 1, '[]', 0, 0, NULL)`,
).join(",\n")};

INSERT INTO pack_words (pack_id, word_id, position) VALUES
${WORDS.map(([id], index) => `('x-p1', '${id}', ${index + 1})`).join(",\n")};
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

async function call(
  path: string,
  options: {
    token?: string
    method?: string
    body?: unknown
  } = {},
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (options.token !== undefined) headers.Authorization = `Bearer ${options.token}`
  if (options.body !== undefined) headers["Content-Type"] = "application/json"

  return fetch(`${worker.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

async function me(oid: string): Promise<MeResponse> {
  const response = await call("/v1/me", { token: await token(oid) })

  expect(response.status).toBe(200)
  return json<MeResponse>(response)
}

async function exams(oid: string): Promise<TopicExamState[]> {
  const response = await call("/v1/me/exams", { token: await token(oid) })

  expect(response.status).toBe(200)
  return (await json<{ exams: TopicExamState[] }>(response)).exams
}

async function createProfile(oid: string): Promise<void> {
  const response = await call("/v1/me/profile", {
    token: await token(oid),
    method: "POST",
    body: {
      characterName: "Hero",
      avatar: "alex",
      currentTopicId: "x-t1",
      locale: "en",
      now: NOW,
    },
  })

  if (response.status !== 201) {
    throw new Error(`profile creation failed: ${await response.text()}`)
  }
}

/** One committed session that introduces the whole pack and moves the counters. */
async function commitIntroducedPack(oid: string): Promise<MeResponse> {
  const response = await call("/v1/me/sessions", {
    token: await token(oid),
    method: "POST",
    body: {
      session: {
        id: "badges-intro",
        kind: "daily",
        localDate: "2026-10-30",
        contentVersion: "v1",
        xpEarned: 100,
        finishedAt: NOW,
      },
      now: NOW,
      profile: {
        xp: 100,
        lastPracticeAt: NOW,
        frozenDays: 0,
        careTokens: 0,
        sessionsSinceLastToken: 1,
        completedSessions: 2,
        streakCount: 1,
        bestStreak: 1,
        lastStreakDate: "2026-10-30",
        lastMonthlyReviewAt: null,
      },
      progress: WORDS.map(([wordId], index) => ({
        wordId,
        status: index === 0 ? "mastered" : "learning",
        strength: index === 0 ? 0.9 : 0.2,
        nextReviewAt: NOW + DAY,
        correctCount: index === 0 ? 3 : 1,
        wrongCount: 0,
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        masteryXpAwarded: index === 0,
      })),
      introductions: WORDS.map(([wordId]) => ({
        packId: "x-p1",
        wordId,
        introducedAt: NOW,
      })),
      metrics: {
        "session.completed": 1,
        "word.learned": WORDS.length,
        "word.mastered": 1,
      },
    },
  })

  if (response.status !== 200) {
    throw new Error(`session commit failed: ${await response.text()}`)
  }

  return json<MeResponse>(response)
}

function factsFrom(
  snapshot: MeResponse,
  examStates: readonly TopicExamState[],
) {
  if (snapshot.profile === null) {
    throw new Error("Expected a profile")
  }

  return badgeFacts({
    profile: snapshot.profile,
    metrics: snapshot.metrics,
    exams: examStates,
  })
}

beforeAll(async () => {
  key = await createTestKey()
  jwks = await startJwksServer(key.jwk)

  try {
    worker = await startWorker(
      workerConfig,
      { ...TEST_ENV, JWKS_URL: jwks.url },
      { migrate: true, seed: BADGES_SEED },
    )
  } catch (error) {
    await jwks.close()
    throw error
  }
})

afterAll(async () => {
  await worker?.stop()
  await jwks?.close()
})

describe("badge facts", () => {
  it("unlocks the medals a committed session crosses", async () => {
    const oid = "user-badges-session"

    await createProfile(oid)

    const before = factsFrom(await me(oid), await exams(oid))

    expect(deriveBadges(before)).toEqual([])

    const committed = await commitIntroducedPack(oid)
    const after = factsFrom(committed, await exams(oid))

    expect(after).toMatchObject({
      wordsLearned: 10,
      wordsMastered: 1,
      bestStreak: 1,
      completedSessions: 2,
      monthlyReviews: 0,
    })
    expect(newlyEarned(before, after)).toEqual([
      "collection.bronze",
      "mastery.bronze",
    ])

    // The counters are cumulative rows, not a live count, so reading them
    // again changes nothing.
    expect(
      worker.query<{ value: number }>(
        `SELECT value FROM metrics WHERE user_id = '${oid}' AND name = 'word.learned'`,
      )[0]?.value,
    ).toBe(10)
  })

  it("awards the topic trophy when the exam completes, and not before", async () => {
    const oid = "user-badges-exam"

    await createProfile(oid)
    await commitIntroducedPack(oid)

    const before = factsFrom(await me(oid), await exams(oid))

    expect(deriveBadges(before)).not.toContain(topicTrophyId("x-t1"))

    const exam = await json<TopicExam>(
      await call("/v1/me/exams/x-t1", { token: await token(oid) }),
    )
    const part = exam.parts[0]
    const spellings = new Map<string, string>(WORDS)

    const submitted = await call("/v1/me/exams", {
      token: await token(oid),
      method: "POST",
      body: {
        topicId: "x-t1",
        partIndex: part.index,
        attemptId: "badges-exam-pass",
        contentVersion: exam.contentVersion,
        answers: part.wordIds.map((wordId) => ({
          wordId,
          answer: spellings.get(wordId),
        })),
      },
    })

    expect(submitted.status).toBe(200)
    const result = await json<ExamResult>(submitted)

    expect(result.state.completedAt).not.toBeNull()

    const after = factsFrom(await me(oid), await exams(oid))

    expect(after.completedTopicIds).toEqual(["x-t1"])
    expect(newlyEarned(before, after)).toEqual([topicTrophyId("x-t1")])

    // A retake leaves the completion — and the trophy — in place.
    const retake = await call("/v1/me/exams", {
      token: await token(oid),
      method: "POST",
      body: {
        topicId: "x-t1",
        partIndex: part.index,
        attemptId: "badges-exam-retake",
        contentVersion: exam.contentVersion,
        answers: part.wordIds.map((wordId) => ({
          wordId,
          answer: spellings.get(wordId),
        })),
      },
    })

    expect(retake.status).toBe(200)

    const afterRetake = factsFrom(await me(oid), await exams(oid))

    expect(newlyEarned(after, afterRetake)).toEqual([])
    expect(deriveBadges(afterRetake)).toContain(topicTrophyId("x-t1"))
  })
})
