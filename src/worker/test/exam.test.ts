import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import type { ExamResult, TopicExam } from "../../shared/exam"
import { METRIC_NAMES } from "../../shared/metrics"
import type { MeResponse } from "../../shared/me"
import { startWorker, workerConfig, type RunningWorker } from "./harness"
import { TEST_ENV, createTestKey, mintToken, type TestKey } from "./tokens"

/**
 * Host tier for feature 35: the real Worker, real local D1 and real tokens.
 * Every row is scoped to the identities this file writes.
 */

const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const EXAM_SEED = `
INSERT INTO topics (id, title, title_zh, icon, description, description_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('x-t1', 'Exam topic', '考试主题', '🔤', 'd', 'd', 1, 0, 0, NULL),
  ('x-t2', 'Second exam topic', '第二考试主题', '🔤', 'd', 'd', 2, 0, 0, NULL);

INSERT INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('x-p1', 'x-t1', 'Pack 1', '包 1', 1, 0, 0, NULL),
  ('x-p2', 'x-t1', 'Pack 2', '包 2', 2, 0, 0, NULL),
  ('x-p3', 'x-t2', 'Pack 3', '包 3', 1, 0, 0, NULL);

INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES
  ('x-w1', 'alpha', '/a/', 'noun', 'first', '第一', 'd', 'd', '[{"en":"alpha","zh":"第一"}]', NULL, NULL, 1, '[]', 0, 0, NULL),
  ('x-w2', 'bravo', '/b/', 'noun', 'second', '第二', 'd', 'd', '[{"en":"bravo","zh":"第二"}]', NULL, NULL, 1, '[]', 0, 0, NULL),
  ('x-w3', 'charlie', '/c/', 'noun', 'third', '第三', 'd', 'd', '[{"en":"charlie","zh":"第三"}]', NULL, NULL, 1, '[]', 0, 0, NULL),
  ('x-w4', 'delta', '/d/', 'noun', 'fourth', '第四', 'd', 'd', '[{"en":"delta","zh":"第四"}]', NULL, NULL, 1, '[]', 0, 0, NULL);

INSERT INTO pack_words (pack_id, word_id, position) VALUES
  ('x-p1', 'x-w1', 1),
  ('x-p1', 'x-w2', 2),
  ('x-p2', 'x-w3', 1),
  ('x-p3', 'x-w4', 1);
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

function count(table: string, where: string): number {
  return (
    worker.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`,
    )[0]?.n ?? 0
  )
}

async function createProfile(oid: string, topicId = "x-t1"): Promise<void> {
  const response = await call("/v1/me/profile", {
    token: await token(oid),
    method: "POST",
    body: {
      characterName: "Hero",
      avatar: "alex",
      currentTopicId: topicId,
      locale: "en",
      now: NOW,
    },
  })

  if (response.status !== 201) {
    throw new Error(`profile creation failed: ${await response.text()}`)
  }
}

async function introduce(
  oid: string,
  sessionId: string,
  entries: readonly { packId: string; wordId: string }[],
): Promise<void> {
  const words = entries.map((entry) => entry.wordId)
  const response = await call("/v1/me/sessions", {
    token: await token(oid),
    method: "POST",
    body: {
      session: {
        id: sessionId,
        kind: "daily",
        localDate: "2026-10-30",
        contentVersion: "v1",
        xpEarned: 0,
        finishedAt: NOW,
      },
      now: NOW,
      profile: {
        xp: 0,
        lastPracticeAt: NOW,
        frozenDays: 0,
        careTokens: 0,
        sessionsSinceLastToken: 0,
        completedSessions: 1,
        streakCount: 1,
        bestStreak: 1,
        lastStreakDate: "2026-10-30",
        lastMonthlyReviewAt: null,
      },
      progress: words.map((wordId) => ({
        wordId,
        status: "learning",
        strength: 0.2,
        nextReviewAt: NOW + DAY,
        correctCount: 1,
        wrongCount: 0,
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        masteryXpAwarded: false,
      })),
      introductions: entries.map((entry) => ({ ...entry, introducedAt: NOW })),
      metrics: {},
    },
  })

  if (response.status !== 200) {
    throw new Error(`introduction commit failed: ${await response.text()}`)
  }
}

async function getExam(oid: string, topicId: string): Promise<TopicExam> {
  const response = await call(`/v1/me/exams/${topicId}`, {
    token: await token(oid),
  })

  expect(response.status).toBe(200)
  return json<TopicExam>(response)
}

async function submit(
  oid: string,
  body: Record<string, unknown>,
): Promise<{ response: Response; result: ExamResult | null }> {
  const response = await call("/v1/me/exams", {
    token: await token(oid),
    method: "POST",
    body,
  })

  return {
    response,
    result: response.status === 200 ? await json<ExamResult>(response) : null,
  }
}

beforeAll(async () => {
  key = await createTestKey()
  jwks = await startJwksServer(key.jwk)

  try {
    worker = await startWorker(
      workerConfig,
      { ...TEST_ENV, JWKS_URL: jwks.url },
      { migrate: true, seed: EXAM_SEED },
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

describe("topic exam", () => {
  const oid = "user-exam"

  it("locks the exam until every topic word is introduced", async () => {
    await createProfile(oid)

    const locked = await getExam(oid, "x-t1")

    expect(locked.gate).toEqual({ introduced: 0, total: 3, unlocked: false })
    expect(locked.parts).toEqual([
      { index: 0, wordIds: ["x-w1", "x-w2", "x-w3"] },
    ])

    const { response } = await submit(oid, {
      topicId: "x-t1",
      partIndex: 0,
      attemptId: "locked-1",
      contentVersion: locked.contentVersion,
      missedWordId: "x-w1",
    })

    expect(response.status).toBe(409)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe("exam_locked")
    expect(count("exam_attempts", `user_id = '${oid}'`)).toBe(0)
  })

  it("opens after the introductions and runs the full fail/pass cycle", async () => {
    await introduce(oid, "exam-intro", [
      { packId: "x-p1", wordId: "x-w1" },
      { packId: "x-p1", wordId: "x-w2" },
      { packId: "x-p2", wordId: "x-w3" },
    ])

    const open = await getExam(oid, "x-t1")
    expect(open.gate).toEqual({ introduced: 3, total: 3, unlocked: true })

    const before = await json<MeResponse>(
      await call("/v1/me", { token: await token(oid) }),
    )

    const failed = await submit(oid, {
      topicId: "x-t1",
      partIndex: 0,
      attemptId: "fail-1",
      contentVersion: open.contentVersion,
      missedWordId: "x-w2",
    })

    expect(failed.response.status).toBe(200)
    expect(failed.result).toMatchObject({
      passed: false,
      missedWordId: "x-w2",
      correctSpelling: "bravo",
    })
    expect(failed.result?.state).toMatchObject({
      passedParts: 0,
      completedAt: null,
    })
    expect(count("exam_attempts", `user_id = '${oid}' AND attempt_id = 'fail-1'`)).toBe(1)
    expect(
      worker.query<{ value: number }>(
        `SELECT value FROM metrics WHERE user_id = '${oid}' AND name = '${METRIC_NAMES.examPartFailed}'`,
      )[0]?.value,
    ).toBe(1)

    const passed = await submit(oid, {
      topicId: "x-t1",
      partIndex: 0,
      attemptId: "pass-1",
      contentVersion: open.contentVersion,
      answers: [
        { wordId: "x-w1", answer: " ALPHA " },
        { wordId: "x-w2", answer: "Bravo" },
        { wordId: "x-w3", answer: "charlie" },
      ],
    })

    expect(passed.response.status).toBe(200)
    expect(passed.result).toMatchObject({
      passed: true,
      missedWordId: null,
      correctSpelling: null,
    })
    expect(passed.result?.state.passedParts).toBe(1)
    expect(passed.result?.state.completedAt).toEqual(expect.any(Number))

    const after = await json<MeResponse>(
      await call("/v1/me", { token: await token(oid) }),
    )

    expect(after.profile).toEqual(before.profile)
    expect(after.progress).toEqual(before.progress)
    expect(
      worker.query<{ value: number }>(
        `SELECT value FROM metrics WHERE user_id = '${oid}' AND name = '${METRIC_NAMES.examPartPassed}'`,
      )[0]?.value,
    ).toBe(1)
    expect(
      worker.query<{ value: number }>(
        `SELECT value FROM metrics WHERE user_id = '${oid}' AND name = '${METRIC_NAMES.examTopicCompleted}'`,
      )[0]?.value,
    ).toBe(1)

    const replayed = await submit(oid, {
      topicId: "x-t1",
      partIndex: 0,
      attemptId: "pass-1",
      contentVersion: open.contentVersion,
      answers: [{ wordId: "x-w1", answer: "alpha" }],
    })

    expect(replayed.result?.passed).toBe(true)
    expect(replayed.result?.state.passedParts).toBe(1)
    expect(
      worker.query<{ attempts: number }>(
        `SELECT attempts FROM topic_exam_progress WHERE user_id = '${oid}' AND topic_id = 'x-t1'`,
      )[0]?.attempts,
    ).toBe(2)

    const conflict = await submit(oid, {
      topicId: "x-t2",
      partIndex: 0,
      attemptId: "pass-1",
      contentVersion: open.contentVersion,
      missedWordId: "x-w4",
    })
    expect(conflict.response.status).toBe(409)
  })

  it("resets an unfinished exam when the content version changes", async () => {
    const oid = "user-exam-stale"
    await createProfile(oid, "x-t2")
    await introduce(oid, "exam-stale-intro", [
      { packId: "x-p3", wordId: "x-w4" },
    ])

    const open = await getExam(oid, "x-t2")
    const failed = await submit(oid, {
      topicId: "x-t2",
      partIndex: 0,
      attemptId: "stale-fail",
      contentVersion: open.contentVersion,
      missedWordId: "x-w4",
    })
    expect(failed.result?.passed).toBe(false)

    worker.query("UPDATE content_meta SET content_version = 'v2' WHERE id = 1;")

    const stale = await submit(oid, {
      topicId: "x-t2",
      partIndex: 0,
      attemptId: "stale-submit",
      contentVersion: open.contentVersion,
      answers: [{ wordId: "x-w4", answer: "delta" }],
    })

    expect(stale.response.status).toBe(409)
    const body = (await stale.response.json()) as { error: { code: string } }
    expect(body.error.code).toBe("exam_stale")
    expect(
      worker.query<{ passed_parts: number; content_version: string }>(
        `SELECT passed_parts, content_version FROM topic_exam_progress WHERE user_id = '${oid}' AND topic_id = 'x-t2'`,
      )[0],
    ).toEqual({ passed_parts: 0, content_version: "v2" })
    expect(count("exam_attempts", `user_id = '${oid}' AND attempt_id = 'stale-submit'`)).toBe(0)
  })

  it("keeps a completed exam completed when content grows", async () => {
    const open = await getExam(oid, "x-t1")
    expect(open.state?.completedAt).toEqual(expect.any(Number))
    expect(open.contentVersion).toBe("v2")

    const retake = await submit(oid, {
      topicId: "x-t1",
      partIndex: 0,
      attemptId: "retake-1",
      contentVersion: open.contentVersion,
      answers: [
        { wordId: "x-w1", answer: "alpha" },
        { wordId: "x-w2", answer: "bravo" },
        { wordId: "x-w3", answer: "charlie" },
      ],
    })

    expect(retake.result?.passed).toBe(true)
    expect(retake.result?.state.completedAt).toEqual(open.state?.completedAt)
    expect(
      worker.query<{ passed_parts: number; content_version: string }>(
        `SELECT passed_parts, content_version FROM topic_exam_progress WHERE user_id = '${oid}' AND topic_id = 'x-t1'`,
      )[0],
    ).toEqual({ passed_parts: 1, content_version: "v2" })
  })
})
