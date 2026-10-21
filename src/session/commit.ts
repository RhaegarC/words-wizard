import type {
  ProgressProvider,
  SessionCommitPayload,
} from "../db/provider"

/**
 * The only impure step of feature 09: hand a finished payload to feature 05's
 * transaction. The guard is in memory because a double submit happens inside
 * one open summary; a commit that survives a reload is the stored row itself.
 */
export class SessionCommitGuard {
  private readonly committed = new Set<string>()

  /**
   * Mark the session before the transaction opens, so two taps in the same
   * tick cannot both reach the store. A failed commit is forgotten so the
   * child can retry.
   */
  async run(
    sessionId: string,
    commit: () => Promise<void>,
  ): Promise<boolean> {
    if (this.committed.has(sessionId)) {
      return false
    }

    this.committed.add(sessionId)

    try {
      await commit()
      return true
    } catch (error) {
      this.committed.delete(sessionId)
      throw error
    }
  }
}

/** One guard per page load, shared by every session the app commits. */
export const sessionCommitGuard = new SessionCommitGuard()

export function commitSessionResult(
  provider: ProgressProvider,
  sessionId: string,
  payload: SessionCommitPayload,
  guard: SessionCommitGuard = sessionCommitGuard,
): Promise<boolean> {
  return guard.run(sessionId, () => provider.commitSession(payload))
}
