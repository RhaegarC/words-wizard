import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import type {
  AdminPack,
  AdminSnapshot,
  AdminTopic,
} from "../../shared/admin"
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
let teacherToken: string

function staffToken(oid: string, roles: readonly string[]): Promise<string> {
  return mintToken(key, { oid, roles })
}

async function call(
  path: string,
  options: {
    token?: string
    method?: string
    origin?: string
    body?: unknown
    ifMatch?: string
  } = {},
): Promise<Response> {
  const headers: Record<string, string> = {}
  let body: string | undefined

  if (options.token !== undefined) headers.Authorization = `Bearer ${options.token}`
  if (options.origin !== undefined) headers.Origin = options.origin
  if (options.ifMatch !== undefined) headers["If-Match"] = options.ifMatch

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(options.body)
  }

  return fetch(`${worker.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
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

  teacherToken = await staffToken("a-teacher", ["teacher"])
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

interface WriteResult<T> {
  readonly contentVersion: string
  readonly warnings: ReadonlyArray<{ code: string; severity: string }>
  readonly topic?: T
  readonly pack?: T
}

interface PublicBundle {
  readonly topics: ReadonlyArray<{ id: string }>
  readonly packs: ReadonlyArray<{
    id: string
    topicId: string
    order: number
    wordIds: string[]
  }>
  readonly words: ReadonlyArray<{ id: string }>
}

async function currentVersion(): Promise<string> {
  const response = await call("/health")
  return ((await response.json()) as { contentVersion: string }).contentVersion
}

async function snapshotFor(token: string): Promise<AdminSnapshot> {
  const response = await call("/v1/admin/content", { token })
  return (await response.json()) as AdminSnapshot
}

async function publicBundle(): Promise<PublicBundle> {
  const response = await call("/v1/content")
  return (await response.json()) as PublicBundle
}

async function createTopic(
  title: string,
  overrides: Partial<{
    titleZh: string
    icon: string
    description: string
    descriptionZh: string
  }> = {},
): Promise<WriteResult<AdminTopic>> {
  const version = await currentVersion()
  const response = await call("/v1/admin/topics", {
    token: teacherToken,
    method: "POST",
    ifMatch: `"${version}"`,
    body: {
      title,
      titleZh: overrides.titleZh ?? `${title} 中文`,
      icon: overrides.icon ?? "🔤",
      description: overrides.description ?? "A topic.",
      descriptionZh: overrides.descriptionZh ?? "一个主题。",
    },
  })

  expect(response.status).toBe(201)
  return (await response.json()) as WriteResult<AdminTopic>
}

async function createPack(
  topicId: string,
  title: string,
  titleZh = `${title} 中文`,
): Promise<WriteResult<AdminPack>> {
  const version = await currentVersion()
  const response = await call("/v1/admin/packs", {
    token: teacherToken,
    method: "POST",
    ifMatch: `"${version}"`,
    body: { topicId, title, titleZh },
  })

  expect(response.status).toBe(201)
  return (await response.json()) as WriteResult<AdminPack>
}

function insertWord(id: string): void {
  worker.query(
    `INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES ('${id}', '${id}', '/x/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"It is ${id}.","zh":"它。"}]', NULL, NULL, 1, '[]', 0, 0, NULL);`,
  )
}

function addToPack(packId: string, wordId: string, position = 1): void {
  worker.query(
    `INSERT INTO pack_words (pack_id, word_id, position) VALUES ('${packId}', '${wordId}', ${position});`,
  )
}

describe("creating topics", () => {
  it("derives the id, stores the row, and bumps the content version", async () => {
    const before = await currentVersion()
    const result = await createTopic("Craft & Build", {
      titleZh: "手工与建造",
      icon: "🔨",
    })

    expect(result.topic?.id).toBe("craft-build")
    expect(result.topic?.archivedAt).toBeNull()
    expect(result.contentVersion).not.toBe(before)
    expect(result.warnings.every((issue) => issue.severity === "warning")).toBe(
      true,
    )

    const snapshot = await snapshotFor(teacherToken)
    expect(
      snapshot.topics.find((topic) => topic.id === "craft-build"),
    ).toMatchObject({
      title: "Craft & Build",
      titleZh: "手工与建造",
      icon: "🔨",
      archivedAt: null,
    })

    expect(await currentVersion()).toBe(result.contentVersion)

    const content = await call("/v1/content")
    expect(content.headers.get("etag")).toBe(`"${result.contentVersion}"`)
  })

  it("suffixes a duplicate title instead of colliding", async () => {
    const first = await createTopic("Duplicate Topic")
    const second = await createTopic("Duplicate Topic")

    expect(first.topic?.id).toBe("duplicate-topic")
    expect(second.topic?.id).toBe("duplicate-topic-2")
  })

  it("returns the downgraded empty-topic warning without blocking", async () => {
    const result = await createTopic("Empty Topic")

    expect(result.warnings.map((issue) => issue.code)).toContain(
      "topic-no-packs",
    )
    expect(
      result.warnings.find((issue) => issue.code === "topic-no-packs")?.severity,
    ).toBe("warning")
  })
})

describe("creating packs", () => {
  it("derives <topicId>-<n> and skips numbers used by archived packs", async () => {
    const topic = (await createTopic("Pack Numbers")).topic!

    const first = (await createPack(topic.id, "First")).pack!
    expect(first.id).toBe(`${topic.id}-1`)

    const version = await currentVersion()
    const archived = await call(`/v1/admin/packs/${first.id}/archive`, {
      token: teacherToken,
      method: "POST",
      ifMatch: `"${version}"`,
    })
    expect(archived.status).toBe(200)

    const second = (await createPack(topic.id, "Second")).pack!
    const third = (await createPack(topic.id, "Third")).pack!

    expect(second.id).toBe(`${topic.id}-2`)
    expect(third.id).toBe(`${topic.id}-3`)
  })

  it("returns the downgraded empty-pack warning without blocking", async () => {
    const topic = (await createTopic("Warning Topic")).topic!
    const result = await createPack(topic.id, "Empty Pack")

    expect(result.warnings.map((issue) => issue.code)).toContain(
      "pack-no-words",
    )
    expect(
      result.warnings.find((issue) => issue.code === "pack-no-words")?.severity,
    ).toBe("warning")
  })
})

describe("editing topics and packs", () => {
  it("changes the stored fields and never the generated id", async () => {
    const topic = (await createTopic("Edit Me")).topic!

    const response = await call(`/v1/admin/topics/${topic.id}`, {
      token: teacherToken,
      method: "PATCH",
      ifMatch: `"${await currentVersion()}"`,
      body: {
        title: "Edited Topic",
        titleZh: "已编辑",
        icon: "🔧",
        description: "Edited.",
        descriptionZh: "已编辑。",
      },
    })
    const result = (await response.json()) as WriteResult<AdminTopic>

    expect(response.status).toBe(200)
    expect(result.topic?.id).toBe(topic.id)
    expect(result.topic?.title).toBe("Edited Topic")
    expect(result.topic?.icon).toBe("🔧")

    const snapshot = await snapshotFor(teacherToken)
    expect(snapshot.topics.find((row) => row.id === topic.id)?.title).toBe(
      "Edited Topic",
    )
  })

  it("edits a pack title and keeps its topic immutable", async () => {
    const topic = (await createTopic("Pack Edit Topic")).topic!
    const pack = (await createPack(topic.id, "Original Pack")).pack!

    const edited = await call(`/v1/admin/packs/${pack.id}`, {
      token: teacherToken,
      method: "PATCH",
      ifMatch: `"${await currentVersion()}"`,
      body: { title: "Renamed Pack" },
    })
    const result = (await edited.json()) as WriteResult<AdminPack>

    expect(edited.status).toBe(200)
    expect(result.pack?.id).toBe(pack.id)
    expect(result.pack?.title).toBe("Renamed Pack")
    expect(result.pack?.topicId).toBe(topic.id)

    const moved = await call(`/v1/admin/packs/${pack.id}`, {
      token: teacherToken,
      method: "PATCH",
      ifMatch: `"${await currentVersion()}"`,
      body: { topicId: "another-topic" },
    })
    expect(moved.status).toBe(422)
  })
})

describe("ordering", () => {
  it("renumbers packs contiguously and the child app sees the new order", async () => {
    const topic = (await createTopic("Order Topic")).topic!
    const first = (await createPack(topic.id, "First")).pack!
    const second = (await createPack(topic.id, "Second")).pack!
    const third = (await createPack(topic.id, "Third")).pack!

    const response = await call("/v1/admin/packs/order", {
      token: teacherToken,
      method: "PUT",
      ifMatch: `"${await currentVersion()}"`,
      body: { topicId: topic.id, ids: [third.id, first.id, second.id] },
    })

    expect(response.status).toBe(200)

    const snapshot = await snapshotFor(teacherToken)
    expect(
      snapshot.packs
        .filter((pack) => pack.topicId === topic.id)
        .map((pack) => [pack.id, pack.sortOrder]),
    ).toEqual([
      [third.id, 1],
      [first.id, 2],
      [second.id, 3],
    ])

    const content = await publicBundle()
    expect(
      content.packs
        .filter((pack) => pack.topicId === topic.id)
        .map((pack) => [pack.id, pack.order]),
    ).toEqual([
      [third.id, 1],
      [first.id, 2],
      [second.id, 3],
    ])
  })

  it("renumbers topics and rejects an order list that omits a live topic", async () => {
    const first = (await createTopic("Order Topic A")).topic!
    const second = (await createTopic("Order Topic B")).topic!

    const version = await currentVersion()
    const rejected = await call("/v1/admin/topics/order", {
      token: teacherToken,
      method: "PUT",
      ifMatch: `"${version}"`,
      body: { ids: [second.id] },
    })

    expect(rejected.status).toBe(422)
    expect(await currentVersion()).toBe(version)

    const snapshot = await snapshotFor(teacherToken)
    const liveIds = snapshot.topics
      .filter((topic) => topic.archivedAt === null)
      .map((topic) => topic.id)
    const reversed = [...liveIds].reverse()

    const accepted = await call("/v1/admin/topics/order", {
      token: teacherToken,
      method: "PUT",
      ifMatch: `"${version}"`,
      body: { ids: reversed },
    })

    expect(accepted.status).toBe(200)

    const after = await snapshotFor(teacherToken)
    expect(
      after.topics
        .filter((topic) => topic.archivedAt === null)
        .map((topic) => topic.id),
    ).toEqual(reversed)
    expect(first.id).not.toBe(second.id)
  })
})

describe("archiving and restoring", () => {
  it("hides an archived topic, its packs, and its words from /v1/content", async () => {
    const topic = (await createTopic("Hidden Topic")).topic!
    const pack = (await createPack(topic.id, "Hidden Pack")).pack!

    insertWord("t-w-hidden")
    addToPack(pack.id, "t-w-hidden")

    const before = await publicBundle()
    expect(before.topics.map((row) => row.id)).toContain(topic.id)
    expect(before.words.map((row) => row.id)).toContain("t-w-hidden")

    const archived = await call(`/v1/admin/topics/${topic.id}/archive`, {
      token: teacherToken,
      method: "POST",
      ifMatch: `"${await currentVersion()}"`,
    })
    expect(archived.status).toBe(200)

    const hidden = await publicBundle()
    expect(hidden.topics.map((row) => row.id)).not.toContain(topic.id)
    expect(hidden.packs.map((row) => row.id)).not.toContain(pack.id)
    expect(hidden.words.map((row) => row.id)).not.toContain("t-w-hidden")

    const snapshot = await snapshotFor(teacherToken)
    expect(
      snapshot.topics.find((row) => row.id === topic.id)?.archivedAt,
    ).toEqual(expect.any(Number))
    expect(snapshot.packs.find((row) => row.id === pack.id)).toBeDefined()
    expect(snapshot.words.find((row) => row.id === "t-w-hidden")).toBeDefined()
    expect(
      snapshot.memberships.find((row) => row.packId === pack.id)?.wordIds,
    ).toEqual(["t-w-hidden"])

    const restored = await call(`/v1/admin/topics/${topic.id}/restore`, {
      token: teacherToken,
      method: "POST",
      ifMatch: `"${await currentVersion()}"`,
    })
    expect(restored.status).toBe(200)

    const visible = await publicBundle()
    expect(visible.topics.map((row) => row.id)).toContain(topic.id)
    expect(visible.words.map((row) => row.id)).toContain("t-w-hidden")
  })

  it("archiving a pack hides only that pack and keeps its words in the library", async () => {
    const topic = (await createTopic("Pack Archive Topic")).topic!
    const archivedPack = (await createPack(topic.id, "Archived Pack")).pack!
    const livePack = (await createPack(topic.id, "Live Pack")).pack!

    insertWord("t-w-pack-only")
    addToPack(archivedPack.id, "t-w-pack-only")
    insertWord("t-w-pack-other")
    addToPack(livePack.id, "t-w-pack-other")

    const archived = await call(
      `/v1/admin/packs/${archivedPack.id}/archive`,
      {
        token: teacherToken,
        method: "POST",
        ifMatch: `"${await currentVersion()}"`,
      },
    )
    expect(archived.status).toBe(200)

    const content = await publicBundle()
    expect(content.topics.map((row) => row.id)).toContain(topic.id)
    expect(content.packs.map((row) => row.id)).toContain(livePack.id)
    expect(content.packs.map((row) => row.id)).not.toContain(archivedPack.id)
    expect(content.words.map((row) => row.id)).not.toContain("t-w-pack-only")
    expect(content.words.map((row) => row.id)).toContain("t-w-pack-other")

    const snapshot = await snapshotFor(teacherToken)
    expect(
      snapshot.words.find((row) => row.id === "t-w-pack-only")?.id,
    ).toBe("t-w-pack-only")
    expect(
      snapshot.packs.find((row) => row.id === archivedPack.id)?.archivedAt,
    ).toEqual(expect.any(Number))
  })

  it("refuses to edit an archived row until it is restored", async () => {
    const topic = (await createTopic("Archived Edit Topic")).topic!

    await call(`/v1/admin/topics/${topic.id}/archive`, {
      token: teacherToken,
      method: "POST",
      ifMatch: `"${await currentVersion()}"`,
    })

    const refused = await call(`/v1/admin/topics/${topic.id}`, {
      token: teacherToken,
      method: "PATCH",
      ifMatch: `"${await currentVersion()}"`,
      body: { title: "Too Early" },
    })
    expect(refused.status).toBe(409)
    expect(
      ((await refused.json()) as { error?: { code?: string } }).error?.code,
    ).toBe("archived")

    await call(`/v1/admin/topics/${topic.id}/restore`, {
      token: teacherToken,
      method: "POST",
      ifMatch: `"${await currentVersion()}"`,
    })

    const accepted = await call(`/v1/admin/topics/${topic.id}`, {
      token: teacherToken,
      method: "PATCH",
      ifMatch: `"${await currentVersion()}"`,
      body: { title: "Restored And Edited" },
    })
    expect(accepted.status).toBe(200)
  })

  it("does not bump the version for a no-op archive or restore", async () => {
    const topic = (await createTopic("No-op Topic")).topic!

    const first = await call(`/v1/admin/topics/${topic.id}/archive`, {
      token: teacherToken,
      method: "POST",
      ifMatch: `"${await currentVersion()}"`,
    })
    const firstResult = (await first.json()) as WriteResult<AdminTopic>
    const second = await call(`/v1/admin/topics/${topic.id}/archive`, {
      token: teacherToken,
      method: "POST",
      ifMatch: `"${firstResult.contentVersion}"`,
    })
    const secondResult = (await second.json()) as WriteResult<AdminTopic>

    expect(second.status).toBe(200)
    expect(secondResult.contentVersion).toBe(firstResult.contentVersion)
    expect(await currentVersion()).toBe(firstResult.contentVersion)
  })
})

describe("concurrency", () => {
  it("rejects a write carrying a stale content version", async () => {
    const stale = await currentVersion()
    await createTopic("Stale First")

    const response = await call("/v1/admin/topics", {
      token: teacherToken,
      method: "POST",
      ifMatch: `"${stale}"`,
      body: {
        title: "Stale Second",
        titleZh: "第二个",
        icon: "🔤",
        description: "d",
        descriptionZh: "d",
      },
    })

    expect(response.status).toBe(409)
    expect(
      ((await response.json()) as { error?: { code?: string } }).error?.code,
    ).toBe("conflict")

    const snapshot = await snapshotFor(teacherToken)
    expect(
      snapshot.topics.some((row) => row.id === "stale-second"),
    ).toBe(false)
  })
})
