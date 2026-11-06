import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import type { AdminSnapshot } from "../../shared/admin"
import { startWorker, workerConfig, type RunningWorker } from "./harness"
import { TEST_ENV, createTestKey, mintToken, type TestKey } from "./tokens"

/**
 * Host tier: the admin boundary and read model on the real Worker, the real
 * local D1, and real RS256 tokens. The seed uses an `a-` prefix and every
 * assertion is scoped to those ids.
 */

vi.setConfig({ testTimeout: 90_000 })

const ADMIN_SEED = `
INSERT INTO topics (id, title, title_zh, icon, description, description_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('a-t-live', 'Live topic', '实时主题', 'LT', 'd', 'd', 1, 0, 0, NULL),
  ('a-t-archived', 'Archived topic', '归档主题', 'AT', 'd', 'd', 2, 0, 0, 111);

INSERT INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('a-p-live', 'a-t-live', 'Live pack', '在线包', 1, 0, 0, NULL),
  ('a-p-archived', 'a-t-live', 'Archived pack', '归档包', 2, 0, 0, 222),
  ('a-p-hidden', 'a-t-archived', 'Hidden pack', '隐藏包', 1, 0, 0, NULL);

INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES
  ('a-w1', 'a-w1', '/w1/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"I see a-w1.","zh":"我看到 a-w1。"}]', NULL, NULL, 1, '[]', 0, 0, NULL),
  ('a-w2', 'a-w2', '/w2/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"I see a-w2.","zh":"我看到 a-w2。"}]', NULL, NULL, 2, '[]', 0, 0, NULL),
  ('a-w-free', 'a-w-free', '/free/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"I see a-w-free.","zh":"我看到 a-w-free。"}]', NULL, 'FR', 1, '["abstract"]', 0, 0, NULL),
  ('a-w-archived', 'a-w-archived', '/old/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"I see a-w-archived.","zh":"我看到 a-w-archived。"}]', NULL, NULL, 3, '[]', 0, 0, 333);

INSERT INTO pack_words (pack_id, word_id, position) VALUES
  ('a-p-live', 'a-w2', 1),
  ('a-p-live', 'a-w1', 2),
  ('a-p-live', 'a-w-archived', 3),
  ('a-p-archived', 'a-w1', 1),
  ('a-p-hidden', 'a-w-free', 1);
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

function staffToken(oid: string, roles: readonly string[]): Promise<string> {
  return mintToken(key, { oid, roles })
}

async function call(
  path: string,
  options: { token?: string; method?: string; origin?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {}

  if (options.token !== undefined) headers.Authorization = `Bearer ${options.token}`
  if (options.origin !== undefined) headers.Origin = options.origin

  return fetch(`${worker.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
  })
}

function snapshotOf(value: unknown): AdminSnapshot {
  return value as AdminSnapshot
}

beforeAll(async () => {
  key = await createTestKey()
  jwks = await startJwksServer(key.jwk)

  try {
    worker = await startWorker(
      workerConfig,
      { ...TEST_ENV, JWKS_URL: jwks.url },
      { migrate: true, seed: ADMIN_SEED },
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

describe("the admin boundary", () => {
  it("answers 401 anonymously on every admin route", async () => {
    for (const path of ["/v1/admin/content", "/v1/admin/access"]) {
      const response = await call(path)

      expect(response.status, path).toBe(401)
      expect(response.headers.get("cache-control")).toBe("no-store")
    }
  })

  it("answers 403 for a signed-in user on every admin route", async () => {
    const token = await staffToken("a-user", [])

    for (const path of ["/v1/admin/content", "/v1/admin/access"]) {
      const response = await call(path, { token })

      expect(response.status, path).toBe(403)
      expect((await response.json()) as unknown).toEqual({
        error: {
          code: "forbidden",
          message: expect.any(String),
        },
      })
    }
  })

  it("lets a teacher and an admin read their role", async () => {
    const teacher = await staffToken("a-teacher", ["teacher"])
    const admin = await staffToken("a-admin", ["admin"])

    const teacherResponse = await call("/v1/admin/access", { token: teacher })
    const adminResponse = await call("/v1/admin/access", { token: admin })

    expect(teacherResponse.status).toBe(200)
    expect(await teacherResponse.json()).toEqual({ role: "teacher" })
    expect(adminResponse.status).toBe(200)
    expect(await adminResponse.json()).toEqual({ role: "admin" })
  })

  it("answers 405 with Allow for a wrong method", async () => {
    const token = await staffToken("a-teacher", ["teacher"])
    const response = await call("/v1/admin/content", {
      token,
      method: "POST",
    })

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("GET")
  })

  it("allows the portal origin through CORS", async () => {
    const origin = "http://localhost:8444"
    const response = await call("/v1/admin/content", {
      method: "OPTIONS",
      origin,
    })

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe(origin)
    expect(response.headers.get("access-control-allow-methods")).toContain("PUT")
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "If-Match",
    )
  })
})

describe("GET /v1/admin/content", () => {
  it("returns archived rows, unassigned words, and ordered membership", async () => {
    const token = await staffToken("a-teacher", ["teacher"])
    const response = await call("/v1/admin/content", { token })
    const snapshot = snapshotOf(await response.json())

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("etag")).toBeNull()

    expect(snapshot.contentVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(snapshot.dataset).toBe("dev")

    const topics = snapshot.topics.filter((topic) => topic.id.startsWith("a-t-"))
    const packs = snapshot.packs.filter((pack) => pack.id.startsWith("a-p-"))
    const words = snapshot.words.filter((word) => word.id.startsWith("a-w"))
    const memberships = snapshot.memberships.filter((membership) =>
      membership.packId.startsWith("a-p-"),
    )

    expect(topics.map((topic) => topic.id)).toEqual(["a-t-live", "a-t-archived"])
    expect(topics[1]?.archivedAt).toBe(111)
    expect(packs.map((pack) => pack.id)).toEqual([
      "a-p-live",
      "a-p-archived",
      "a-p-hidden",
    ])
    expect(words.map((word) => word.id)).toEqual([
      "a-w-archived",
      "a-w-free",
      "a-w1",
      "a-w2",
    ])

    const byPack = new Map(
      memberships.map((membership) => [
        membership.packId,
        membership.wordIds,
      ]),
    )
    // Position order, archived word included.
    expect(byPack.get("a-p-live")).toEqual(["a-w2", "a-w1", "a-w-archived"])
    // A word in no active pack is still in the admin snapshot.
    expect(byPack.get("a-p-hidden")).toEqual(["a-w-free"])
  })
})
