import { describe, expect, it, vi } from "vitest"

import type { AuthConfig } from "../../auth/config"
import {
  createSessionLoader,
  restoreSession,
  type MsalSessionClient,
  type RedirectOptions,
} from "../../auth/session"

interface Account {
  localAccountId: string
}

interface FakeOptions {
  readonly redirectAccount?: Account | null
  readonly activeAccount?: Account | null
  readonly cachedAccounts?: Account[]
  readonly initializeError?: Error
}

function fakeClient(options: FakeOptions = {}) {
  const calls = {
    initialize: 0,
    handleRedirect: [] as Array<RedirectOptions | undefined>,
    setActive: [] as Account[],
  }

  const client: MsalSessionClient<Account> = {
    initialize: async () => {
      calls.initialize += 1
      if (options.initializeError !== undefined) {
        throw options.initializeError
      }
    },
    handleRedirectPromise: async (request) => {
      calls.handleRedirect.push(request)
      return options.redirectAccount === undefined
        ? null
        : { account: options.redirectAccount }
    },
    getActiveAccount: () => options.activeAccount ?? null,
    getAllAccounts: () => [...(options.cachedAccounts ?? [])],
    setActiveAccount: (account) => {
      calls.setActive.push(account)
    },
  }

  return { client, calls }
}

function config(clientId = "client-1"): AuthConfig {
  return {
    clientId,
    tenantId: "tenant-1",
    apiBaseUrl: "https://api.example.test",
    avatarBaseUrl: "https://api.example.test/v1/avatars",
    authority: "https://login.example.test/tenant-1",
    redirectUri: "https://app.example.test/",
    postLogoutRedirectUri: "https://app.example.test/",
    scopes: ["openid", "profile", "api://client-1/access_as_user"],
  }
}

describe("restoreSession", () => {
  it("applies the redirect response without navigating away from it", async () => {
    const account = { localAccountId: "oid-1" }
    const fake = fakeClient({ redirectAccount: account })

    await expect(restoreSession(fake.client)).resolves.toBe(account)

    expect(fake.calls.handleRedirect).toEqual([
      { navigateToLoginRequestUrl: false },
    ])
    expect(fake.calls.setActive).toEqual([account])
  })

  it("falls back to the active account when there is no redirect", async () => {
    const account = { localAccountId: "oid-1" }
    const fake = fakeClient({ activeAccount: account })

    await expect(restoreSession(fake.client)).resolves.toBe(account)
    expect(fake.calls.setActive).toEqual([account])
  })

  it("falls back to the first cached account", async () => {
    const account = { localAccountId: "oid-1" }
    const fake = fakeClient({ cachedAccounts: [account] })

    await expect(restoreSession(fake.client)).resolves.toBe(account)
    expect(fake.calls.setActive).toEqual([account])
  })

  it("reports no account when the client has none", async () => {
    const fake = fakeClient()

    await expect(restoreSession(fake.client)).resolves.toBeNull()
    expect(fake.calls.setActive).toEqual([])
  })

  it("fails when the client cannot initialize", async () => {
    const fake = fakeClient({ initializeError: new Error("no crypto") })

    await expect(restoreSession(fake.client)).rejects.toThrow("no crypto")
    expect(fake.calls.handleRedirect).toEqual([])
  })
})

describe("createSessionLoader", () => {
  it("initializes and handles the redirect once for a repeated load", async () => {
    const account = { localAccountId: "oid-1" }
    const fake = fakeClient({ redirectAccount: account })
    const createClient = vi.fn(() => fake.client)
    const load = createSessionLoader(createClient)

    const first = load(config())
    const second = load(config())

    expect(createClient).toHaveBeenCalledTimes(1)
    expect(first.client).toBe(second.client)
    await expect(Promise.all([first.ready, second.ready])).resolves.toEqual([
      account,
      account,
    ])
    expect(fake.calls.initialize).toBe(1)
    expect(fake.calls.handleRedirect).toHaveLength(1)
  })

  it("starts a new session when the config changes", () => {
    const createClient = vi.fn(() => fakeClient().client)
    const load = createSessionLoader(createClient)

    const first = load(config("client-1"))
    const second = load(config("client-2"))

    expect(createClient).toHaveBeenCalledTimes(2)
    expect(first.client).not.toBe(second.client)
  })
})
