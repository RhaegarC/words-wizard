import { describe, expect, it, vi } from "vitest"

import type {
  ProgressProvider,
  SessionCommitPayload,
} from "@shared/provider"

import { commitSessionResult, SessionCommitGuard } from "./commit"

const NOW = 1_760_000_000_000

function makePayload(): SessionCommitPayload {
  return {
    profileId: 1,
    now: NOW,
    xpEarned: 7,
    profile: { xp: 52 },
    progress: [],
    metrics: {},
  }
}

/**
 * A purpose-built recording double: it records that the store was entered and
 * does nothing else. Its claim is the one only a double can prove — that a
 * second submit never reaches the store at all.
 */
function recordingProvider() {
  const commits: SessionCommitPayload[] = []
  const provider = {
    commitSession: async (payload: SessionCommitPayload) => {
      commits.push(payload)
    },
  } as unknown as ProgressProvider

  return { provider, commits }
}

describe("SessionCommitGuard", () => {
  it("runs a session's commit once and rejects a second submit", async () => {
    const guard = new SessionCommitGuard()
    const commit = vi.fn(async () => {})

    await expect(guard.run("session-1", commit)).resolves.toBe(true)
    await expect(guard.run("session-1", commit)).resolves.toBe(false)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it("rejects a second submit while the first is still in flight", async () => {
    const guard = new SessionCommitGuard()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const commit = vi.fn(async () => {
      await gate
    })

    const first = guard.run("session-1", commit)
    const second = await guard.run("session-1", commit)

    expect(second).toBe(false)

    release()
    await expect(first).resolves.toBe(true)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it("allows a retry after the commit throws", async () => {
    const guard = new SessionCommitGuard()
    const failing = vi.fn(async () => {
      throw new Error("transaction failed")
    })

    await expect(guard.run("session-1", failing)).rejects.toThrow(
      "transaction failed",
    )

    const retry = vi.fn(async () => {})

    await expect(guard.run("session-1", retry)).resolves.toBe(true)
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("tracks each session id separately", async () => {
    const guard = new SessionCommitGuard()
    const commit = vi.fn(async () => {})

    await expect(guard.run("session-1", commit)).resolves.toBe(true)
    await expect(guard.run("session-2", commit)).resolves.toBe(true)
    expect(commit).toHaveBeenCalledTimes(2)
  })
})

describe("commitSessionResult", () => {
  it("hands the payload to the provider once", async () => {
    const { provider, commits } = recordingProvider()
    const guard = new SessionCommitGuard()
    const payload = makePayload()

    await expect(
      commitSessionResult(provider, "session-1", payload, guard),
    ).resolves.toBe(true)
    await expect(
      commitSessionResult(provider, "session-1", payload, guard),
    ).resolves.toBe(false)

    expect(commits).toEqual([payload])
  })
})
