import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { ContentBundle } from "../../shared/content/types"
import { validateContent } from "../../shared/content/validate"
import { srcRoot, startWorker, workerConfig, type RunningWorker } from "./harness"
import { TEST_ENV } from "./tokens"

/**
 * Host tier: the Worker is booted in `wrangler dev` against unreachable
 * network endpoints. It proves the real runtime, config middleware, routing,
 * CORS wiring, and the content route answering from a migrated local D1.
 * The content claims are shape claims: the database holds only the seeded
 * avatars and `content_meta`, so empty topics/packs/words are correct.
 */

const missingConfig = join(
  srcRoot,
  "worker",
  "test",
  "fixtures",
  "wrangler-missing-config.jsonc",
)

/**
 * Fixture rows for the bundle-shape claims. The seed migration only carries
 * avatars and `content_meta`; vocabulary rows are authored SQL (feature 17),
 * so the host tier inserts its own and keeps them row-scoped.
 */
const CONTENT_SEED = `
INSERT INTO topics (id, title, title_zh, icon, description, description_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('t1', 'Topic 1', '主题 1', '🔤', 'd1', 'd1', 1, 0, 0, NULL),
  ('t2', 'Topic 2', '主题 2', '🔤', 'd2', 'd2', 2, 0, 0, NULL),
  ('t-archived', 'Archived', '已归档', '🔤', 'd3', 'd3', 3, 0, 0, 1);

INSERT INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at, archived_at) VALUES
  ('p1', 't1', 'Pack 1', '包 1', 1, 0, 0, NULL),
  ('p2', 't1', 'Pack 2', '包 2', 2, 0, 0, NULL),
  ('p3', 't2', 'Pack 3', '包 3', 1, 0, 0, NULL),
  ('p-archived', 't1', 'Archived pack', '已归档包', 3, 0, 0, 1),
  ('p-under-archived', 't-archived', 'Hidden pack', '隐藏包', 1, 0, 0, NULL);

INSERT INTO words (id, text, phonetic, part_of_speech, meaning_en, meaning_zh, definition_en, definition_zh, examples, image, emoji, level, tags, created_at, updated_at, archived_at) VALUES
  ('w1', 'w1', '/w1/', 'noun', 'm1', 'm1', 'd1', 'd1', '[{"en":"I see w1.","zh":"我看到 w1。"}]', NULL, NULL, 1, '["abstract"]', 0, 0, NULL),
  ('w2', 'w2', '/w2/', 'noun', 'm2', 'm2', 'd2', 'd2', '[{"en":"I see w2.","zh":"我看到 w2。"}]', NULL, NULL, 1, '["abstract"]', 0, 0, NULL),
  ('w3', 'w3', '/w3/', 'noun', 'm3', 'm3', 'd3', 'd3', '[{"en":"I see w3.","zh":"我看到 w3。"}]', NULL, NULL, 1, '["abstract"]', 0, 0, NULL),
  ('w4', 'w4', '/w4/', 'noun', 'm4', 'm4', 'd4', 'd4', '[{"en":"I see w4.","zh":"我看到 w4。"}]', 'https://images.example.test/w4.webp', '🅰️', 2, '["abstract"]', 0, 0, NULL),
  ('w-archived', 'w-archived', '/wa/', 'noun', 'ma', 'ma', 'da', 'da', '[{"en":"I see it.","zh":"我看到它。"}]', NULL, NULL, 1, '[]', 0, 0, 1),
  ('w-unserved', 'w-unserved', '/wu/', 'noun', 'mu', 'mu', 'du', 'du', '[{"en":"I see it.","zh":"我看到它。"}]', NULL, NULL, 1, '[]', 0, 0, NULL);

INSERT INTO pack_words (pack_id, word_id, position) VALUES
  ('p1', 'w2', 2),
  ('p1', 'w1', 1),
  ('p2', 'w3', 1),
  ('p3', 'w3', 1),
  ('p3', 'w4', 2),
  ('p-archived', 'w1', 1),
  ('p-under-archived', 'w2', 1),
  ('p1', 'w-archived', 3);
`


describe("host tier: wrangler dev", () => {
  let worker: RunningWorker

  beforeAll(async () => {
    worker = await startWorker(
      workerConfig,
      { ...TEST_ENV },
      { migrate: true, seed: CONTENT_SEED },
    )
  }, 120_000)

  afterAll(async () => {
    await worker?.stop()
  })

  it("serves GET /health with the seeded content version", async () => {
    const response = await fetch(`${worker.baseUrl}/health`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, contentVersion: "0.3.0" })
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("serves the content bundle from D1 with a version ETag", async () => {
    const response = await fetch(`${worker.baseUrl}/v1/content`)
    const body = (await response.json()) as {
      meta: { contentVersion: string; dataset: string }
      topics: Array<{ id: string }>
      packs: Array<{ id: string; wordIds: string[] }>
      words: Array<{ id: string; topicIds: string[] }>
      avatars: unknown[]
    }

    expect(response.status).toBe(200)
    expect(response.headers.get("etag")).toBe('"0.3.0"')
    expect(response.headers.get("cache-control")).toBe("public, max-age=300")
    expect(body.meta).toEqual({
      schemaVersion: 1,
      dataset: "dev",
      contentVersion: "0.3.0",
    })

    // Archived topics, packs, and words are not served.
    expect(body.topics.map((item) => item.id)).toEqual(["t1", "t2"])
    expect(body.packs.map((item) => item.id)).toEqual(["p1", "p2", "p3"])
    expect(body.words.map((item) => item.id)).toEqual(["w1", "w2", "w3", "w4"])

    // Pack order follows `pack_words.position`, not insertion order.
    expect(body.packs[0]?.wordIds).toEqual(["w1", "w2"])

    // `topicIds` is derived, ordered by topic then pack.
    const topicsById = new Map(body.words.map((item) => [item.id, item.topicIds]))
    expect(topicsById.get("w1")).toEqual(["t1"])
    expect(topicsById.get("w3")).toEqual(["t1", "t2"])
    expect(topicsById.get("w4")).toEqual(["t2"])

    expect(body.avatars).toHaveLength(8)
  })

  it("answers 304 when the client already has the current version", async () => {
    const response = await fetch(`${worker.baseUrl}/v1/content`, {
      headers: { "If-None-Match": '"0.3.0"' },
    })

    expect(response.status).toBe(304)
    expect(await response.text()).toBe("")
  })

  it("serves the bundle when the client has a stale version", async () => {
    const response = await fetch(`${worker.baseUrl}/v1/content`, {
      headers: { "If-None-Match": '"0.2.0"' },
    })

    expect(response.status).toBe(200)
  })

  it("assembles a bundle the content validator accepts with no findings", async () => {
    const response = await fetch(`${worker.baseUrl}/v1/content`)
    const bundle = (await response.json()) as ContentBundle
    const forbiddenTerms = JSON.parse(
      readFileSync(
        join(srcRoot, "shared", "content", "rules", "forbidden-terms.json"),
        "utf8",
      ),
    ) as string[]

    // At `dataset = "dev"` a warning is still a finding: this fixture is a
    // clean dataset, so a new rule that fires here is a real regression.
    expect(validateContent(bundle, { forbiddenTerms })).toEqual([])
  })

  it("serves only words with an active topic and a complete record", async () => {
    const response = await fetch(`${worker.baseUrl}/v1/content`)
    const bundle = (await response.json()) as ContentBundle

    for (const word of bundle.words) {
      expect(word.topicIds.length).toBeGreaterThan(0)
      expect(word.examples.length).toBeGreaterThan(0)
      expect([1, 2, 3]).toContain(word.level)
      expect(word.image === null || /^https?:\/\//.test(word.image)).toBe(true)
    }

    for (const topic of bundle.topics) {
      expect(bundle.packs.some((pack) => pack.topicId === topic.id)).toBe(true)
    }

    for (const pack of bundle.packs) {
      expect(pack.wordIds.length).toBeGreaterThan(0)
    }
  })

  it("keeps every pack's positions contiguous from 1", () => {
    const broken = worker.query<{ pack_id: string }>(
      `SELECT p.id AS pack_id
         FROM packs p
         LEFT JOIN (
           SELECT pack_id, COUNT(*) AS total, MIN(position) AS low, MAX(position) AS high
             FROM pack_words GROUP BY pack_id
         ) w ON w.pack_id = p.id
        WHERE w.total IS NULL OR w.low <> 1 OR w.high <> w.total`,
    )

    expect(broken).toEqual([])
  })

  it("has no dangling foreign keys", () => {
    expect(worker.query<Record<string, unknown>>("PRAGMA foreign_key_check")).toEqual(
      [],
    )
  })

  it("returns the 404 envelope for an unknown route", async () => {
    const response = await fetch(`${worker.baseUrl}/v1/nope`)

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      error: { code: "not_found" },
    })
  })

  it("answers an allowed preflight with 204 and CORS headers", async () => {
    const response = await fetch(`${worker.baseUrl}/health`, {
      method: "OPTIONS",
      headers: { Origin: "https://words.nioh.uk" },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://words.nioh.uk",
    )
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "GET",
    )
  })

  it("sends no allow-origin for an unlisted origin", async () => {
    const response = await fetch(`${worker.baseUrl}/health`, {
      headers: { Origin: "https://evil.test" },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })
})

describe("host tier: fail-fast configuration", () => {
  it("fails every request with 500 config_missing when a required var is absent", async () => {
    const worker = await startWorker(missingConfig)

    try {
      const response = await fetch(`${worker.baseUrl}/health`)
      const body = (await response.json()) as {
        error: Record<string, string>
      }

      expect(response.status).toBe(500)
      expect(body.error.code).toBe("config_missing")
      expect(body.error.message).toContain("EXPECTED_TENANT")
      expect(JSON.stringify(body)).not.toContain("stack")
    } finally {
      await worker.stop()
    }
  }, 120_000)
})
