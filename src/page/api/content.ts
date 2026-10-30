import type { ContentBundle } from "@shared/content/types"

import type { ApiClient } from "./client"

/**
 * The content read path. `GET /v1/content` is a public route served by the
 * Worker, so the client attaches its token like every other request but the
 * response is validated here before it can replace the active bundle.
 *
 * The browser's HTTP cache performs ETag revalidation; the client never sends
 * `If-None-Match` itself, so a boot never has to rebuild a bundle from a
 * bodiless `304`.
 */

export class ContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ContentError"
  }
}

export async function fetchContent(client: ApiClient): Promise<ContentBundle> {
  const body = await client.request<unknown>("/v1/content")

  if (!isContentBundle(body)) {
    throw new ContentError("The content bundle is malformed.")
  }

  return body
}

const DATASETS = ["dev", "final"] as const

export function isContentBundle(value: unknown): value is ContentBundle {
  if (!isRecord(value)) {
    return false
  }

  const meta = value.meta

  if (
    !isRecord(meta) ||
    typeof meta.schemaVersion !== "number" ||
    !DATASETS.includes(meta.dataset as (typeof DATASETS)[number]) ||
    typeof meta.contentVersion !== "string"
  ) {
    return false
  }

  return (
    isListOf(value.topics, "id") &&
    isListOf(value.packs, "id") &&
    isListOf(value.words, "id") &&
    isListOf(value.avatars, "id")
  )
}

function isListOf(value: unknown, key: string): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item[key] === "string" &&
        (item[key] as string).trim() !== "",
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
