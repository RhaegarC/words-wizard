/**
 * Returning `false` keeps the child on the current screen. `nextHash` lets a
 * host allow its own internal moves (session intro → exercise) without asking.
 */
export type BeforeLeaveHandler = (nextHash?: string) => boolean

export type LeaveGuard = {
  setBeforeLeave(handler: BeforeLeaveHandler | null): void
  canLeave(nextHash?: string): boolean
}

/**
 * One navigation veto shared by every way out of a screen. The session engine
 * registers a handler for mid-session exits; with none registered, leaving is
 * always allowed.
 */
export function createLeaveGuard(): LeaveGuard {
  let handler: BeforeLeaveHandler | null = null

  return {
    setBeforeLeave(next) {
      handler = next
    },
    canLeave(nextHash) {
      if (!handler) {
        return true
      }

      try {
        return handler(nextHash)
      } catch {
        // A broken confirm dialog must never trap the child in a screen.
        return true
      }
    },
  }
}
