import { describe, expect, it, vi } from "vitest"

import { ApiError, createApiClient } from "./client"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function requestOf(
  fetchFn: ReturnType<typeof vi.fn>,
  call = 0,
): RequestInit {
  return fetchFn.mock.calls[call]?.[1] as RequestInit
}

function pathOf(fetchFn: ReturnType<typeof vi.fn>, call = 0): string {
  return fetchFn.mock.calls[call]?.[0] as string
}

describe("createApiClient", () => {
  it("joins the base url, attaches the bearer token, and parses JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    const client = createApiClient({
      baseUrl: "https://api.example.test/",
      getToken: async () => "token-1",
      onUnauthorized: () => {},
      fetchFn,
    })

    await expect(client.request("/v1/me")).resolves.toEqual({ ok: true })
    expect(pathOf(fetchFn)).toBe("https://api.example.test/v1/me")
    expect(requestOf(fetchFn).headers).toEqual({
      Authorization: "Bearer token-1",
    })
  })

  it("serialises a JSON body and its content type", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      getToken: async () => "token-1",
      onUnauthorized: () => {},
      fetchFn,
    })

    await client.request("/v1/me/sessions", {
      method: "POST",
      body: { session: { id: "s-1" } },
    })

    expect(requestOf(fetchFn).method).toBe("POST")
    expect(requestOf(fetchFn).body).toBe('{"session":{"id":"s-1"}}')
    expect(requestOf(fetchFn).headers).toMatchObject({
      "Content-Type": "application/json",
    })
  })

  it("surfaces the error envelope as an ApiError", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: { code: "validation_failed", message: "Bad body." } },
        422,
      ),
    )
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      getToken: async () => "token-1",
      onUnauthorized: () => {},
      fetchFn,
    })

    const error = await client.request("/v1/me/sessions", {}).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      code: "validation_failed",
      status: 422,
      message: "Bad body.",
    })
    expect((error as ApiError).retryable).toBe(false)
  })

  it("marks a network failure retryable", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("failed to fetch"))
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      getToken: async () => "token-1",
      onUnauthorized: () => {},
      fetchFn,
    })

    const error = await client.request("/v1/me").catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: "network", status: 0 })
    expect((error as ApiError).retryable).toBe(true)
  })

  it.each([500, 503])("marks a %i response retryable", async (status) => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: "internal", message: "Internal." } }, status),
    )
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      getToken: async () => "token-1",
      onUnauthorized: () => {},
      fetchFn,
    })

    const error = await client.request("/v1/me").catch((e) => e)

    expect((error as ApiError).retryable).toBe(true)
  })

  it("refreshes once after a 401 and retries with the new token", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "unauthorized", message: "No." } }, 401),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    const getToken = vi
      .fn()
      .mockResolvedValueOnce("stale")
      .mockResolvedValueOnce("fresh")
    const onUnauthorized = vi.fn()
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      getToken,
      onUnauthorized,
      fetchFn,
    })

    await expect(client.request("/v1/me")).resolves.toEqual({ ok: true })

    expect(getToken).toHaveBeenCalledTimes(2)
    expect(getToken).toHaveBeenLastCalledWith({ forceRefresh: true })
    expect(requestOf(fetchFn, 1).headers).toEqual({
      Authorization: "Bearer fresh",
    })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it("signs out when the refreshed token is refused as well", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: "unauthorized", message: "No." } }, 401),
      )
    const onUnauthorized = vi.fn().mockResolvedValue(undefined)
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      getToken: async () => "token-1",
      onUnauthorized,
      fetchFn,
    })

    const error = await client.request("/v1/me").catch((e) => e)

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
  })

  it("does not refresh for a non-401 failure", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: "not_found", message: "No." } }, 404),
      )
    const getToken = vi.fn().mockResolvedValue("token-1")
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      getToken,
      onUnauthorized: () => {},
      fetchFn,
    })

    await client.request("/v1/me").catch(() => undefined)

    expect(getToken).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
