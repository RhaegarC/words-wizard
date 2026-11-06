import { describe, expect, it } from "vitest"

import { createApp } from "../app"
import { TEST_ENV } from "./tokens"

/**
 * The admin write boundary (feature 29) without a database.
 *
 * A request that reaches `requireDb` with no binding answers 500
 * `config_missing`; a body rejected before that point proves the rule ran
 * offline, before any row was read or written.
 */

type TestRole = "user" | "teacher" | "admin"

function appFor(role: TestRole) {
  return createApp({
    verifierFor: () => async () => ({
      oid: "admin-write-test",
      email: "staff@example.test",
      role,
    }),
  })
}

function jsonHeaders(): Record<string, string> {
  return {
    Authorization: "Bearer token",
    "Content-Type": "application/json",
    "If-Match": '"0.3.0"',
  }
}

async function errorOf(response: Response): Promise<{
  code?: string
  message?: string
  issues?: unknown[]
}> {
  const payload = (await response.json()) as {
    error?: { code?: string; message?: string; issues?: unknown[] }
  }

  return payload.error ?? {}
}

const TOPIC_BODY = {
  title: "Craft & Build",
  titleZh: "手工与建造",
  icon: "🔨",
  description: "Make things.",
  descriptionZh: "做东西。",
}

const WORD_BODY = {
  text: "brave",
  phonetic: "/breɪv/",
  partOfSpeech: "adjective",
  meaningEn: "Ready to face danger.",
  meaningZh: "勇敢的。",
  definitionEn: "Not afraid.",
  definitionZh: "不害怕。",
  examples: [{ en: "The brave knight smiled.", zh: "勇敢的骑士笑了。" }],
  level: 2,
  tags: ["abstract"],
  emoji: "🦁",
}

describe("the write gate", () => {
  it("answers 401 anonymously on every write route", async () => {
    const routes = [
      ["POST", "/v1/admin/topics"],
      ["PATCH", "/v1/admin/topics/topic-a"],
      ["POST", "/v1/admin/topics/topic-a/archive"],
      ["POST", "/v1/admin/topics/topic-a/restore"],
      ["PUT", "/v1/admin/topics/order"],
      ["POST", "/v1/admin/packs"],
      ["PATCH", "/v1/admin/packs/pack-a"],
      ["POST", "/v1/admin/packs/pack-a/archive"],
      ["POST", "/v1/admin/packs/pack-a/restore"],
      ["PUT", "/v1/admin/packs/order"],
      ["POST", "/v1/admin/words"],
      ["PATCH", "/v1/admin/words/word-a"],
      ["PUT", "/v1/admin/packs/pack-a/membership"],
    ] as const

    for (const [method, path] of routes) {
      const response = await createApp().request(
        path,
        { method, headers: { "Content-Type": "application/json" }, body: "{}" },
        TEST_ENV,
      )

      expect(response.status, `${method} ${path}`).toBe(401)
      expect((await errorOf(response)).code).toBe("unauthorized")
    }
  })

  it("answers 403 for a signed-in user before the body is read", async () => {
    const response = await appFor("user").request(
      "/v1/admin/topics",
      { method: "POST", headers: jsonHeaders(), body: JSON.stringify(TOPIC_BODY) },
      TEST_ENV,
    )

    expect(response.status).toBe(403)
    expect((await response.json()) as unknown).toEqual({
      error: { code: "forbidden", message: expect.any(String) },
    })
  })

  it("reaches the handler for a teacher: the missing database is the proof", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/topics",
      { method: "POST", headers: jsonHeaders(), body: JSON.stringify(TOPIC_BODY) },
      TEST_ENV,
    )

    expect(response.status).toBe(500)
    expect((await errorOf(response)).code).toBe("config_missing")
  })
})

describe("body rules run before the database", () => {
  it("rejects malformed JSON", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/topics",
      { method: "POST", headers: jsonHeaders(), body: "{not json" },
      TEST_ENV,
    )

    expect(response.status).toBe(400)
    expect((await errorOf(response)).code).toBe("invalid_json")
  })

  it("rejects a body with an unknown field", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/topics",
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ ...TOPIC_BODY, id: "client-chosen" }),
      },
      TEST_ENV,
    )

    expect(response.status).toBe(422)
    expect((await errorOf(response)).code).toBe("validation_failed")
  })

  it("rejects a blank required field", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/packs",
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ topicId: "topic-a", title: "  ", titleZh: "标题" }),
      },
      TEST_ENV,
    )

    expect(response.status).toBe(422)
    expect((await errorOf(response)).code).toBe("validation_failed")
  })

  it("rejects an empty patch", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/topics/topic-a",
      { method: "PATCH", headers: jsonHeaders(), body: "{}" },
      TEST_ENV,
    )

    expect(response.status).toBe(422)
    expect((await errorOf(response)).code).toBe("validation_failed")
  })

  it("rejects an order list with a duplicate id", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/packs/order",
      {
        method: "PUT",
        headers: jsonHeaders(),
        body: JSON.stringify({ topicId: "topic-a", ids: ["pack-a", "pack-a"] }),
      },
      TEST_ENV,
    )

    expect(response.status).toBe(422)
    expect((await errorOf(response)).code).toBe("validation_failed")
  })

  it("rejects a word outside the level range", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/words",
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ ...WORD_BODY, level: 4 }),
      },
      TEST_ENV,
    )

    expect(response.status).toBe(422)
    expect((await errorOf(response)).code).toBe("validation_failed")
  })

  it("rejects a word with no examples", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/words",
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ ...WORD_BODY, examples: [] }),
      },
      TEST_ENV,
    )

    expect(response.status).toBe(422)
    expect((await errorOf(response)).code).toBe("validation_failed")
  })

  it("rejects an image, which only the upload route writes", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/words",
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ ...WORD_BODY, image: "https://example.test/a.png" }),
      },
      TEST_ENV,
    )

    expect(response.status).toBe(422)
    expect((await errorOf(response)).code).toBe("validation_failed")
  })

  it("rejects a membership list with a duplicate id", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/packs/pack-a/membership",
      {
        method: "PUT",
        headers: jsonHeaders(),
        body: JSON.stringify({ ids: ["w-a", "w-a"] }),
      },
      TEST_ENV,
    )

    expect(response.status).toBe(422)
    expect((await errorOf(response)).code).toBe("validation_failed")
  })

  it("lets a valid word body reach the handler", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/words",
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(WORD_BODY),
      },
      TEST_ENV,
    )

    expect(response.status).toBe(500)
    expect((await errorOf(response)).code).toBe("config_missing")
  })
})

describe("method handling", () => {
  it("answers 405 with Allow on a parameterised write route", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/topics/topic-a",
      { method: "DELETE", headers: jsonHeaders() },
      TEST_ENV,
    )

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("PATCH")
  })

  it("matches the exact order path before the parameterised one", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/topics/order",
      { method: "POST", headers: jsonHeaders(), body: "{}" },
      TEST_ENV,
    )

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("PUT")
  })

  it("answers 405 on an archive route with a wrong method", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/packs/pack-a/archive",
      { method: "GET", headers: jsonHeaders() },
      TEST_ENV,
    )

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("POST")
  })

  it("still answers 404 for a longer path", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/topics/topic-a/extra",
      { method: "DELETE", headers: jsonHeaders() },
      TEST_ENV,
    )

    expect(response.status).toBe(404)
  })

  it("offers no delete route for a word", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/words/word-a",
      { method: "DELETE", headers: jsonHeaders() },
      TEST_ENV,
    )

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("PATCH")
  })

  it("answers 405 on the membership route with the wrong method", async () => {
    const response = await appFor("teacher").request(
      "/v1/admin/packs/pack-a/membership",
      { method: "POST", headers: jsonHeaders(), body: "{}" },
      TEST_ENV,
    )

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("PUT")
  })
})
