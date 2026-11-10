import type {
  AdminAccess,
  AdminMembership,
  AdminPack,
  AdminSnapshot,
  AdminTopic,
  AdminWord,
} from "../shared/admin"
import type {
  PackCreatePayload,
  PackPatchPayload,
  TopicCreatePayload,
  TopicPatchPayload,
  WordCreatePayload,
  WordPatchPayload,
} from "../shared/adminWrite"
import type { ContentIssue } from "../shared/content/types"

/**
 * The admin API client. A non-2xx response is an error the screen acts on:
 * 401 means the session expired, 403 means Access Denied, 409 is either a
 * stale editor or an archived row, and 422 carries the validator's findings.
 */
export class AdminRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly issues?: readonly unknown[],
  ) {
    super(message)
    this.name = "AdminRequestError"
  }
}

export interface TopicWriteResult {
  readonly contentVersion: string
  readonly warnings: ContentIssue[]
  readonly topic?: AdminTopic
}

export interface PackWriteResult {
  readonly contentVersion: string
  readonly warnings: ContentIssue[]
  readonly pack?: AdminPack
}

/**
 * A word write. Creating from a pack returns the membership that was extended
 * in the same batch, so the screen refreshes the pack without a second call.
 */
export interface WordWriteResult {
  readonly contentVersion: string
  readonly warnings: ContentIssue[]
  readonly word?: AdminWord
  readonly membership?: AdminMembership
}

export interface MembershipWriteResult {
  readonly contentVersion: string
  readonly warnings: ContentIssue[]
  readonly membership?: AdminMembership
}

export interface AdminApi {
  access(): Promise<AdminAccess>
  snapshot(): Promise<AdminSnapshot>

  createTopic(
    input: TopicCreatePayload,
    contentVersion: string,
  ): Promise<TopicWriteResult>
  updateTopic(
    topicId: string,
    input: TopicPatchPayload,
    contentVersion: string,
  ): Promise<TopicWriteResult>
  setTopicArchived(
    topicId: string,
    archived: boolean,
    contentVersion: string,
  ): Promise<TopicWriteResult>
  orderTopics(
    ids: readonly string[],
    contentVersion: string,
  ): Promise<TopicWriteResult>
  createPack(
    input: PackCreatePayload,
    contentVersion: string,
  ): Promise<PackWriteResult>
  updatePack(
    packId: string,
    input: PackPatchPayload,
    contentVersion: string,
  ): Promise<PackWriteResult>
  setPackArchived(
    packId: string,
    archived: boolean,
    contentVersion: string,
  ): Promise<PackWriteResult>
  orderPacks(
    topicId: string,
    ids: readonly string[],
    contentVersion: string,
  ): Promise<PackWriteResult>
  createWord(
    input: WordCreatePayload,
    contentVersion: string,
  ): Promise<WordWriteResult>
  updateWord(
    wordId: string,
    input: WordPatchPayload,
    contentVersion: string,
  ): Promise<WordWriteResult>
  uploadWordImage(
    wordId: string,
    file: Blob,
    contentVersion: string,
  ): Promise<WordWriteResult>
  removeWordImage(
    wordId: string,
    contentVersion: string,
  ): Promise<WordWriteResult>
  saveMembership(
    packId: string,
    ids: readonly string[],
    contentVersion: string,
  ): Promise<MembershipWriteResult>
}

interface ErrorPayload {
  code?: string
  message?: string
  issues?: readonly unknown[]
}

async function readError(response: Response): Promise<ErrorPayload> {
  try {
    const payload = (await response.json()) as { error?: ErrorPayload }
    return payload.error ?? {}
  } catch {
    return {}
  }
}

async function send<T>(
  request: typeof fetch,
  apiBaseUrl: string,
  token: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  let response: Response

  try {
    response = await request(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    })
  } catch {
    throw new AdminRequestError(0, "The server could not be reached.")
  }

  if (!response.ok) {
    const payload = await readError(response)

    throw new AdminRequestError(
      response.status,
      response.status === 403
        ? "This account does not have admin access."
        : (payload.message ?? "The admin request failed."),
      payload.code,
      payload.issues,
    )
  }

  return (await response.json()) as T
}

function jsonInit(method: string, body: unknown, contentVersion: string): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      "If-Match": `"${contentVersion}"`,
    },
    body: JSON.stringify(body),
  }
}

/**
 * One client bound to a token and an API origin. The token is captured when
 * the shell loads; a refreshed token rebuilds the client.
 */
export function createAdminApi(
  apiBaseUrl: string,
  token: string,
  request: typeof fetch = fetch,
): AdminApi {
  const get = <T>(path: string): Promise<T> =>
    send<T>(request, apiBaseUrl, token, path, {
      headers: { "Content-Type": "application/json" },
    })

  const write = <T>(
    path: string,
    method: string,
    body: unknown,
    contentVersion: string,
  ): Promise<T> =>
    send<T>(
      request,
      apiBaseUrl,
      token,
      path,
      jsonInit(method, body, contentVersion),
    )

  return {
    access: () => get<AdminAccess>("/v1/admin/access"),
    snapshot: () => get<AdminSnapshot>("/v1/admin/content"),

    createTopic: (input, contentVersion) =>
      write<TopicWriteResult>("/v1/admin/topics", "POST", input, contentVersion),
    updateTopic: (topicId, input, contentVersion) =>
      write<TopicWriteResult>(
        `/v1/admin/topics/${topicId}`,
        "PATCH",
        input,
        contentVersion,
      ),
    setTopicArchived: (topicId, archived, contentVersion) =>
      write<TopicWriteResult>(
        `/v1/admin/topics/${topicId}/${archived ? "archive" : "restore"}`,
        "POST",
        {},
        contentVersion,
      ),
    orderTopics: (ids, contentVersion) =>
      write<TopicWriteResult>(
        "/v1/admin/topics/order",
        "PUT",
        { ids: [...ids] },
        contentVersion,
      ),

    createPack: (input, contentVersion) =>
      write<PackWriteResult>("/v1/admin/packs", "POST", input, contentVersion),
    updatePack: (packId, input, contentVersion) =>
      write<PackWriteResult>(
        `/v1/admin/packs/${packId}`,
        "PATCH",
        input,
        contentVersion,
      ),
    setPackArchived: (packId, archived, contentVersion) =>
      write<PackWriteResult>(
        `/v1/admin/packs/${packId}/${archived ? "archive" : "restore"}`,
        "POST",
        {},
        contentVersion,
      ),
    orderPacks: (topicId, ids, contentVersion) =>
      write<PackWriteResult>(
        "/v1/admin/packs/order",
        "PUT",
        { topicId, ids: [...ids] },
        contentVersion,
      ),

    createWord: (input, contentVersion) =>
      write<WordWriteResult>("/v1/admin/words", "POST", input, contentVersion),
    updateWord: (wordId, input, contentVersion) =>
      write<WordWriteResult>(
        `/v1/admin/words/${wordId}`,
        "PATCH",
        input,
        contentVersion,
      ),
    // No Content-Type: the browser sets the multipart boundary itself.
    uploadWordImage: (wordId, file, contentVersion) => {
      const body = new FormData()
      body.append("file", file)

      return send<WordWriteResult>(
        request,
        apiBaseUrl,
        token,
        `/v1/admin/words/${wordId}/image`,
        {
          method: "POST",
          headers: { "If-Match": `"${contentVersion}"` },
          body,
        },
      )
    },
    removeWordImage: (wordId, contentVersion) =>
      send<WordWriteResult>(
        request,
        apiBaseUrl,
        token,
        `/v1/admin/words/${wordId}/image`,
        {
          method: "DELETE",
          headers: { "If-Match": `"${contentVersion}"` },
        },
      ),
    saveMembership: (packId, ids, contentVersion) =>
      write<MembershipWriteResult>(
        `/v1/admin/packs/${packId}/membership`,
        "PUT",
        { ids: [...ids] },
        contentVersion,
      ),
  }
}

// The feature-28 helpers stay for callers that only read.
export function fetchAdminAccess(
  apiBaseUrl: string,
  token: string,
): Promise<AdminAccess> {
  return createAdminApi(apiBaseUrl, token).access()
}

export function fetchAdminSnapshot(
  apiBaseUrl: string,
  token: string,
): Promise<AdminSnapshot> {
  return createAdminApi(apiBaseUrl, token).snapshot()
}
