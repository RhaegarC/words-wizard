import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import type {
  AdminMembership,
  AdminPack,
  AdminSnapshot,
  AdminTopic,
  AdminWord,
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

function insertWord(id: string, emoji: string | null = null): void {
  const emojiSql = emoji === null ? "NULL" : `'${emoji}'`

  worker.query(
    `INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES ('${id}', '${id}', '/x/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"It is ${id}.","zh":"它。"}]', NULL, ${emojiSql}, 1, '[]', 0, 0, NULL);`,
  )
}

function addToPack(packId: string, wordId: string, position = 1): void {
  worker.query(
    `INSERT INTO pack_words (pack_id, word_id, position) VALUES ('${packId}', '${wordId}', ${position});`,
  )
}

function insertArchivedWord(id: string, text: string): void {
  worker.query(
    `INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES ('${id}', '${text}', '/x/', 'noun', 'm', 'm', 'd', 'd', '[{"en":"It is ${text}.","zh":"它。"}]', NULL, NULL, 1, '[]', 0, 0, 333);`,
  )
}

interface WordWriteResult {
  readonly contentVersion: string
  readonly warnings: ReadonlyArray<{ code: string; message: string }>
  readonly word?: AdminWord
  readonly membership?: AdminMembership
}

interface MembershipWriteResult {
  readonly contentVersion: string
  readonly warnings: ReadonlyArray<{ code: string; message: string }>
  readonly membership?: AdminMembership
}

function wordBody(
  text: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    text,
    phonetic: `/${text}/`,
    partOfSpeech: "noun",
    meaningEn: `The meaning of ${text}.`,
    meaningZh: `${text} 的意思。`,
    definitionEn: "A definition.",
    definitionZh: "一个定义。",
    examples: [{ en: `I can see the ${text}.`, zh: `我能看到 ${text}。` }],
    level: 1,
    tags: [],
    emoji: "🦁",
    ...overrides,
  }
}

async function createWord(
  text: string,
  overrides: Record<string, unknown> = {},
): Promise<WordWriteResult> {
  const version = await currentVersion()
  const response = await call("/v1/admin/words", {
    token: teacherToken,
    method: "POST",
    ifMatch: `"${version}"`,
    body: wordBody(text, overrides),
  })

  expect(response.status).toBe(201)
  return (await response.json()) as WordWriteResult
}

async function saveMembership(
  packId: string,
  ids: readonly string[],
  version: string,
): Promise<Response> {
  return call(`/v1/admin/packs/${packId}/membership`, {
    token: teacherToken,
    method: "PUT",
    ifMatch: `"${version}"`,
    body: { ids },
  })
}

function membershipOf(
  snapshot: AdminSnapshot,
  packId: string,
): string[] {
  return (
    snapshot.memberships.find((entry) => entry.packId === packId)?.wordIds ?? []
  )
}

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
])
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])

function uploadWordImage(
  wordId: string,
  bytes: Uint8Array<ArrayBuffer> = PNG_BYTES,
  options: {
    token?: string | null
    ifMatch?: string
    name?: string
  } = {},
): Promise<Response> {
  const form = new FormData()
  form.append(
    "file",
    new Blob([bytes], { type: "image/png" }),
    options.name ?? "picture.png",
  )

  const headers: Record<string, string> = {}
  const token = options.token === undefined ? teacherToken : options.token
  if (token !== null) headers.Authorization = `Bearer ${token}`
  if (options.ifMatch !== undefined) headers["If-Match"] = options.ifMatch

  return fetch(`${worker.baseUrl}/v1/admin/words/${wordId}/image`, {
    method: "POST",
    headers,
    body: form,
  })
}

async function removeWordImage(
  wordId: string,
  options: { token?: string | null } = {},
): Promise<Response> {
  const headers: Record<string, string> = {}
  const token = options.token === undefined ? teacherToken : options.token
  if (token !== null) headers.Authorization = `Bearer ${token}`

  return fetch(`${worker.baseUrl}/v1/admin/words/${wordId}/image`, {
    method: "DELETE",
    headers,
  })
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

describe("the word library", () => {
  it("creates a word with a derived id, bumping the version", async () => {
    const before = await currentVersion()
    const result = await createWord("Quokka")

    expect(result.word?.id).toBe("w-quokka")
    expect(result.contentVersion).not.toBe(before)
    expect(result.contentVersion).toBe(await currentVersion())

    const snapshot = await snapshotFor(teacherToken)
    const row = snapshot.words.find((word) => word.id === "w-quokka")

    expect(row).toMatchObject({
      text: "Quokka",
      phonetic: "/Quokka/",
      partOfSpeech: "noun",
      meaningEn: "The meaning of Quokka.",
      meaningZh: "Quokka 的意思。",
      level: 1,
      tags: [],
      emoji: "🦁",
      image: null,
      archivedAt: null,
      topicIds: [],
    })
    expect(row?.examples).toEqual([
      { en: "I can see the Quokka.", zh: "我能看到 Quokka。" },
    ])

    const bundle = await publicBundle()
    expect(bundle.words.some((word) => word.id === "w-quokka")).toBe(false)
  })

  it("suffixes the id when two headwords slug the same", async () => {
    const first = await createWord("Ice Cream")
    const second = await createWord("Ice-Cream")

    expect(first.word?.id).toBe("w-ice-cream")
    expect(second.word?.id).toBe("w-ice-cream-2")
  })

  it("rejects a duplicate headword case-insensitively, writing nothing", async () => {
    await createWord("Narwhal")

    const before = await currentVersion()
    const response = await call("/v1/admin/words", {
      token: teacherToken,
      method: "POST",
      ifMatch: `"${before}"`,
      body: wordBody("narwhal"),
    })

    expect(response.status).toBe(409)
    const payload = (await response.json()) as {
      error: { code: string; message: string }
    }
    expect(payload.error.code).toBe("conflict")
    expect(payload.error.message).toContain("narwhal")
    expect(await currentVersion()).toBe(before)

    const snapshot = await snapshotFor(teacherToken)
    expect(
      snapshot.words.filter((word) => word.text.toLowerCase() === "narwhal"),
    ).toHaveLength(1)
  })

  it("rejects a headword an archived row already uses", async () => {
    insertArchivedWord("f30-w-zephyr", "Zephyr")

    const response = await call("/v1/admin/words", {
      token: teacherToken,
      method: "POST",
      ifMatch: `"${await currentVersion()}"`,
      body: wordBody("zephyr"),
    })

    expect(response.status).toBe(409)
    expect(
      ((await response.json()) as { error?: { code?: string } }).error?.code,
    ).toBe("conflict")
  })
})

describe("editing words", () => {
  it("edits the record without changing the id", async () => {
    const created = await createWord("Puffin")
    expect(created.word?.id).toBe("w-puffin")

    const before = await currentVersion()
    const response = await call("/v1/admin/words/w-puffin", {
      token: teacherToken,
      method: "PATCH",
      ifMatch: `"${before}"`,
      body: {
        meaningZh: "海鹦。",
        level: 3,
        tags: ["abstract"],
        emoji: null,
        examples: [{ en: "A puffin dives.", zh: "海鹦潜水。" }],
      },
    })

    expect(response.status).toBe(200)
    const result = (await response.json()) as WordWriteResult
    expect(result.word?.id).toBe("w-puffin")
    expect(result.contentVersion).not.toBe(before)

    const snapshot = await snapshotFor(teacherToken)
    const row = snapshot.words.find((word) => word.id === "w-puffin")

    expect(row).toMatchObject({
      text: "Puffin",
      meaningZh: "海鹦。",
      level: 3,
      tags: ["abstract"],
    })
    expect(row).not.toHaveProperty("emoji")
    expect(row?.examples).toEqual([
      { en: "A puffin dives.", zh: "海鹦潜水。" },
    ])
  })

  it("refuses an edit that would duplicate another headword", async () => {
    await createWord("Heron")
    await createWord("Crane")

    const before = await currentVersion()
    const response = await call("/v1/admin/words/w-heron", {
      token: teacherToken,
      method: "PATCH",
      ifMatch: `"${before}"`,
      body: { text: "crane" },
    })

    expect(response.status).toBe(409)
    expect(
      ((await response.json()) as { error?: { code?: string } }).error?.code,
    ).toBe("conflict")
    expect(await currentVersion()).toBe(before)

    const snapshot = await snapshotFor(teacherToken)
    expect(
      snapshot.words.find((word) => word.id === "w-heron")?.text,
    ).toBe("Heron")
  })
})

describe("pack membership", () => {
  it("create-with-pack appends the word and serves it", async () => {
    const topic = await createTopic("Feature 30 Create With Pack")
    const pack = await createPack(topic.topic!.id, "First Pack")

    const before = await currentVersion()
    const created = await createWord("Binturong", {
      packId: pack.pack!.id,
    })

    expect(created.word?.id).toBe("w-binturong")
    expect(created.membership?.wordIds).toEqual(["w-binturong"])
    expect(created.contentVersion).not.toBe(before)

    const snapshot = await snapshotFor(teacherToken)
    expect(membershipOf(snapshot, pack.pack!.id)).toEqual(["w-binturong"])

    const bundle = await publicBundle()
    expect(
      bundle.packs.find((candidate) => candidate.id === pack.pack!.id)?.wordIds,
    ).toEqual(["w-binturong"])
    expect(bundle.words.some((word) => word.id === "w-binturong")).toBe(true)
  })

  it("replaces membership in the given order", async () => {
    const topic = await createTopic("Feature 30 Membership Order")
    const pack = await createPack(topic.topic!.id, "Ordered Pack")
    const alpha = await createWord("Xylophone")
    const beta = await createWord("Yacht")
    const gamma = await createWord("Zebra")
    const ids = [gamma.word!.id, alpha.word!.id, beta.word!.id]

    const before = await currentVersion()
    const response = await saveMembership(pack.pack!.id, ids, before)

    expect(response.status).toBe(200)
    const result = (await response.json()) as MembershipWriteResult
    expect(result.membership?.wordIds).toEqual(ids)
    expect(result.contentVersion).not.toBe(before)

    const snapshot = await snapshotFor(teacherToken)
    expect(membershipOf(snapshot, pack.pack!.id)).toEqual(ids)

    const bundle = await publicBundle()
    expect(
      bundle.packs.find((candidate) => candidate.id === pack.pack!.id)?.wordIds,
    ).toEqual(ids)
  })

  it("removing every word hides it from children, keeping it in the library", async () => {
    const topic = await createTopic("Feature 30 Membership Empty")
    const pack = await createPack(topic.topic!.id, "Emptied Pack")
    const word = await createWord("Wombat")

    const first = await saveMembership(
      pack.pack!.id,
      [word.word!.id],
      await currentVersion(),
    )
    expect(first.status).toBe(200)

    const before = await currentVersion()
    const response = await saveMembership(pack.pack!.id, [], before)
    expect(response.status).toBe(200)
    expect(
      ((await response.json()) as MembershipWriteResult).contentVersion,
    ).not.toBe(before)

    const snapshot = await snapshotFor(teacherToken)
    expect(membershipOf(snapshot, pack.pack!.id)).toEqual([])
    expect(
      snapshot.words.some((candidate) => candidate.id === "w-wombat"),
    ).toBe(true)

    const bundle = await publicBundle()
    expect(
      bundle.packs.find((candidate) => candidate.id === pack.pack!.id)?.wordIds,
    ).toEqual([])
    expect(bundle.words.some((candidate) => candidate.id === "w-wombat")).toBe(
      false,
    )
  })

  it("rejects unknown, archived, and duplicate ids without writing", async () => {
    const topic = await createTopic("Feature 30 Membership Rejections")
    const pack = await createPack(topic.topic!.id, "Guarded Pack")
    const word = await createWord("Vicuna")
    insertArchivedWord("f30-w-dodo", "Dodo")

    const before = await currentVersion()

    for (const ids of [
      ["not-a-word"],
      [word.word!.id, "f30-w-dodo"],
      [word.word!.id, word.word!.id],
    ]) {
      const response = await saveMembership(pack.pack!.id, ids, before)

      expect(response.status, JSON.stringify(ids)).toBe(422)
      expect(
        ((await response.json()) as { error?: { code?: string } }).error?.code,
      ).toBe("validation_failed")
    }

    expect(await currentVersion()).toBe(before)
    const snapshot = await snapshotFor(teacherToken)
    expect(membershipOf(snapshot, pack.pack!.id)).toEqual([])
  })

  it("rejects a membership save on an archived pack", async () => {
    const topic = await createTopic("Feature 30 Archived Pack")
    const pack = await createPack(topic.topic!.id, "Hidden Pack")

    const archived = await call(`/v1/admin/packs/${pack.pack!.id}/archive`, {
      token: teacherToken,
      method: "POST",
      ifMatch: `"${await currentVersion()}"`,
    })
    expect(archived.status).toBe(200)

    const response = await saveMembership(
      pack.pack!.id,
      [],
      await currentVersion(),
    )

    expect(response.status).toBe(409)
    expect(
      ((await response.json()) as { error?: { code?: string } }).error?.code,
    ).toBe("archived")
  })

  it("leaves the version alone when the list is unchanged", async () => {
    const topic = await createTopic("Feature 30 Membership No Op")
    const pack = await createPack(topic.topic!.id, "Settled Pack")
    const word = await createWord("Tapir")
    const ids = [word.word!.id]

    await saveMembership(pack.pack!.id, ids, await currentVersion())

    const before = await currentVersion()
    const response = await saveMembership(pack.pack!.id, ids, before)
    const result = (await response.json()) as MembershipWriteResult

    expect(response.status).toBe(200)
    expect(result.contentVersion).toBe(before)
    expect(await currentVersion()).toBe(before)
  })
})

describe("word images", () => {
  it("uploads a PNG, points the word at it, and serves it publicly", async () => {
    insertWord("a-w-image-png")
    const before = await currentVersion()

    const response = await uploadWordImage("a-w-image-png")
    const result = (await response.json()) as WordWriteResult

    expect(response.status).toBe(200)
    expect(result.contentVersion).toBe(await currentVersion())
    expect(result.contentVersion).not.toBe(before)
    expect(result.word?.image).toMatch(
      /\/v1\/images\/word-images\/a-w-image-png\/[A-Za-z0-9-]+\.png$/,
    )

    const served = await fetch(result.word!.image!)
    expect(served.status).toBe(200)
    expect(served.headers.get("content-type")).toBe("image/png")
    expect(served.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    )
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG_BYTES)
  })

  it("keeps the key valid only for the origin it was written from", async () => {
    insertWord("a-w-image-origin")
    const result = (await (
      await uploadWordImage("a-w-image-origin")
    ).json()) as WordWriteResult

    expect(result.word!.image!.startsWith(worker.baseUrl)).toBe(true)
  })

  it("replaces with a new key and deletes the old object", async () => {
    insertWord("a-w-image-replace")
    const first = (await (
      await uploadWordImage("a-w-image-replace", PNG_BYTES)
    ).json()) as WordWriteResult

    const second = (await (
      await uploadWordImage("a-w-image-replace", JPEG_BYTES)
    ).json()) as WordWriteResult

    expect(second.word?.image).not.toBe(first.word?.image)
    expect(second.word?.image).toMatch(/\.jpg$/)
    expect((await fetch(first.word!.image!)).status).toBe(404)

    const served = await fetch(second.word!.image!)
    expect(served.status).toBe(200)
    expect(served.headers.get("content-type")).toBe("image/jpeg")
  })

  it("removes the image, deletes the object, and leaves the emoji fallback", async () => {
    insertWord("a-w-image-remove", "🦁")
    const uploaded = (await (
      await uploadWordImage("a-w-image-remove")
    ).json()) as WordWriteResult
    const before = await currentVersion()

    const response = await removeWordImage("a-w-image-remove")
    const result = (await response.json()) as WordWriteResult

    expect(response.status).toBe(200)
    expect(result.word?.image).toBeNull()
    expect(result.contentVersion).not.toBe(before)
    expect(await currentVersion()).toBe(result.contentVersion)
    expect((await fetch(uploaded.word!.image!)).status).toBe(404)

    const snapshot = await snapshotFor(teacherToken)
    const word = snapshot.words.find((row) => row.id === "a-w-image-remove")
    expect(word?.image).toBeNull()
    expect(word?.emoji).toBe("🦁")
  })

  it("treats removing an absent image as a no-op", async () => {
    insertWord("a-w-image-none")
    const before = await currentVersion()

    const response = await removeWordImage("a-w-image-none")
    const result = (await response.json()) as WordWriteResult

    expect(response.status).toBe(200)
    expect(result.word?.image).toBeNull()
    expect(result.contentVersion).toBe(before)
    expect(await currentVersion()).toBe(before)
  })

  it("rejects a fake and an unsupported image without writing", async () => {
    insertWord("a-w-image-bad")
    const before = await currentVersion()

    for (const bytes of [GIF_BYTES, new Uint8Array([1, 2, 3, 4, 5])]) {
      const response = await uploadWordImage("a-w-image-bad", bytes)

      expect(response.status).toBe(422)
      expect(
        ((await response.json()) as { error?: { code?: string } }).error?.code,
      ).toBe("validation_failed")
    }

    expect(await currentVersion()).toBe(before)
    const snapshot = await snapshotFor(teacherToken)
    expect(
      snapshot.words.find((row) => row.id === "a-w-image-bad")?.image,
    ).toBeNull()
  })

  it("rejects an image larger than 2 MiB without writing", async () => {
    insertWord("a-w-image-large")
    const before = await currentVersion()
    const large = new Uint8Array(2 * 1024 * 1024 + 1)
    large.set(PNG_BYTES)

    const response = await uploadWordImage("a-w-image-large", large)

    expect(response.status).toBe(422)
    expect(await currentVersion()).toBe(before)
    const snapshot = await snapshotFor(teacherToken)
    expect(
      snapshot.words.find((row) => row.id === "a-w-image-large")?.image,
    ).toBeNull()
  })

  it("refuses an archived word for both upload and removal", async () => {
    insertArchivedWord("a-w-image-archived", "Archived image word")
    const before = await currentVersion()

    for (const response of [
      await uploadWordImage("a-w-image-archived"),
      await removeWordImage("a-w-image-archived"),
    ]) {
      expect(response.status).toBe(409)
      expect(
        ((await response.json()) as { error?: { code?: string } }).error?.code,
      ).toBe("archived")
    }

    expect(await currentVersion()).toBe(before)
  })

  it("requires a staff token on upload and removal", async () => {
    insertWord("a-w-image-auth")
    const userToken = await staffToken("a-image-user", [])

    expect((await uploadWordImage("a-w-image-auth", PNG_BYTES, { token: null })).status).toBe(401)
    expect((await uploadWordImage("a-w-image-auth", PNG_BYTES, { token: userToken })).status).toBe(403)
    expect((await removeWordImage("a-w-image-auth", { token: null })).status).toBe(401)
    expect((await removeWordImage("a-w-image-auth", { token: userToken })).status).toBe(403)
  })

  it("answers 404 for a public key the upload route could not have written", async () => {
    for (const path of [
      "/v1/images/avatars/oid-1/0c9f.png",
      "/v1/images/word-images/w-brave/0c9f.gif",
      "/v1/images/word-images/w-brave/missing.png",
    ]) {
      expect((await fetch(`${worker.baseUrl}${path}`)).status, path).toBe(404)
    }
  })
})
