import { describe, expect, it } from "vitest"

import type { WordCreatePayload } from "../../shared/adminWrite"
import { AdminRequestError, createAdminApi } from "../api"

/**
 * The portal's write client against a stubbed `fetch`. The claims are the
 * contract with the Worker: the verb and path, the version header, and how a
 * conflict or a validation rejection reaches the screen.
 */

const TOPIC = {
  title: "Craft & Build",
  titleZh: "手工与建造",
  icon: "🔨",
  description: "Make things.",
  descriptionZh: "做东西。",
}

const TOPIC_ROW = {
  id: "craft-build",
  ...TOPIC,
  sortOrder: 1,
  archivedAt: null,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

interface CapturedCall {
  url: string
  init: RequestInit
}

function apiWith(
  handler: (url: string, init: RequestInit) => Response,
): { api: ReturnType<typeof createAdminApi>; calls: CapturedCall[] } {
  const calls: CapturedCall[] = []
  const request = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} }
    calls.push(call)

    return handler(call.url, call.init)
  }) as typeof fetch

  return {
    api: createAdminApi("https://api.test", "token-abc", request),
    calls,
  }
}

function headersOf(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>
}

describe("creating and editing", () => {
  it("posts a topic with the token and the snapshot version", async () => {
    const { api, calls } = apiWith(() =>
      jsonResponse({
        contentVersion: "0.3.1",
        warnings: [],
        topic: TOPIC_ROW,
      }),
    )

    const result = await api.createTopic(TOPIC, "0.3.0")

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe("https://api.test/v1/admin/topics")
    expect(calls[0]?.init.method).toBe("POST")
    expect(headersOf(calls[0]!.init)).toMatchObject({
      Authorization: "Bearer token-abc",
      "Content-Type": "application/json",
      "If-Match": '"0.3.0"',
    })
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(TOPIC)
    expect(result).toEqual({
      contentVersion: "0.3.1",
      warnings: [],
      topic: TOPIC_ROW,
    })
  })

  it("patches a pack at its parameterised path", async () => {
    const { api, calls } = apiWith(() =>
      jsonResponse({ contentVersion: "0.3.2", warnings: [] }),
    )

    await api.updatePack("craft-build-1", { title: "Renamed" }, "0.3.1")

    expect(calls[0]?.url).toBe("https://api.test/v1/admin/packs/craft-build-1")
    expect(calls[0]?.init.method).toBe("PATCH")
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      title: "Renamed",
    })
  })

  it("chooses archive or restore from the flag", async () => {
    const { api, calls } = apiWith(() =>
      jsonResponse({ contentVersion: "0.4.0", warnings: [] }),
    )

    await api.setTopicArchived("craft-build", true, "0.3.0")
    await api.setTopicArchived("craft-build", false, "0.4.0")

    expect(calls.map((call) => `${call.init.method} ${call.url}`)).toEqual([
      "POST https://api.test/v1/admin/topics/craft-build/archive",
      "POST https://api.test/v1/admin/topics/craft-build/restore",
    ])
  })

  it("puts an order with the topic and the ids", async () => {
    const { api, calls } = apiWith(() =>
      jsonResponse({ contentVersion: "0.4.0", warnings: [] }),
    )

    await api.orderPacks("craft-build", ["craft-build-2", "craft-build-1"], "0.3.0")

    expect(calls[0]?.url).toBe("https://api.test/v1/admin/packs/order")
    expect(calls[0]?.init.method).toBe("PUT")
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      topicId: "craft-build",
      ids: ["craft-build-2", "craft-build-1"],
    })
  })
})

const WORD: WordCreatePayload = {
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

describe("words and membership", () => {
  it("posts a word, carrying the pack when creating from a pack", async () => {
    const { api, calls } = apiWith(() =>
      jsonResponse({ contentVersion: "0.3.1", warnings: [] }),
    )

    await api.createWord({ ...WORD, packId: "craft-build-1" }, "0.3.0")

    expect(calls[0]?.url).toBe("https://api.test/v1/admin/words")
    expect(calls[0]?.init.method).toBe("POST")
    expect(headersOf(calls[0]!.init)["If-Match"]).toBe('"0.3.0"')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      ...WORD,
      packId: "craft-build-1",
    })
  })

  it("patches a word at its parameterised path", async () => {
    const { api, calls } = apiWith(() =>
      jsonResponse({ contentVersion: "0.3.2", warnings: [] }),
    )

    await api.updateWord("w-brave", { meaningZh: "勇敢。" }, "0.3.1")

    expect(calls[0]?.url).toBe("https://api.test/v1/admin/words/w-brave")
    expect(calls[0]?.init.method).toBe("PATCH")
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      meaningZh: "勇敢。",
    })
  })

  it("puts a membership as the full ordered list", async () => {
    const { api, calls } = apiWith(() =>
      jsonResponse({ contentVersion: "0.4.0", warnings: [] }),
    )

    await api.saveMembership(
      "craft-build-1",
      ["w-zebra", "w-quokka"],
      "0.3.0",
    )

    expect(calls[0]?.url).toBe(
      "https://api.test/v1/admin/packs/craft-build-1/membership",
    )
    expect(calls[0]?.init.method).toBe("PUT")
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      ids: ["w-zebra", "w-quokka"],
    })
  })
})

describe("errors the screen acts on", () => {
  it("carries the conflict code from a stale version", async () => {
    const { api } = apiWith(() =>
      jsonResponse(
        { error: { code: "conflict", message: "Content changed." } },
        409,
      ),
    )

    const error: unknown = await api
      .updateTopic("craft-build", { title: "x" }, "0.3.0")
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(AdminRequestError)
    expect(error).toMatchObject({ status: 409, code: "conflict" })
  })

  it("carries the issue list from a validation rejection", async () => {
    const { api } = apiWith(() =>
      jsonResponse(
        {
          error: {
            code: "validation_failed",
            message: "The change has problems.",
            issues: ["title-required"],
          },
        },
        422,
      ),
    )

    const error = (await api
      .createTopic(TOPIC, "0.3.0")
      .catch((caught: unknown) => caught)) as AdminRequestError

    expect(error).toMatchObject({ status: 422, code: "validation_failed" })
    expect(error.issues).toEqual(["title-required"])
  })

  it("reports a server it could not reach as status 0", async () => {
    const request = (async () => {
      throw new TypeError("fetch failed")
    }) as typeof fetch
    const api = createAdminApi("https://api.test", "token-abc", request)

    await expect(api.snapshot()).rejects.toMatchObject({ status: 0 })
  })
})
