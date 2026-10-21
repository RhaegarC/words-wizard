/** Returning `false` keeps the child on the current screen. */
export type BeforeLeaveHandler = () => boolean

export type LeaveGuard = {
  setBeforeLeave(handler: BeforeLeaveHandler | null): void
  canLeave(): boolean
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
    canLeave() {
      if (!handler) {
        return true
      }

      try {
        return handler()
      } catch {
        // A broken confirm dialog must never trap the child in a screen.
        return true
      }
    },
  }
}
