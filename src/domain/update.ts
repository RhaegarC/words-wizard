/**
 * The waiting-worker state machine. A new service worker is never activated on
 * its own: the prompt appears, Later keeps the old worker, and only Refresh
 * asks the plugin to take over. Keeping this pure makes that rule testable
 * without a browser.
 */
export type UpdateStatus = "idle" | "ready" | "updating"

export interface UpdateState {
  status: UpdateStatus
  /** Later hides the card until another worker arrives or the app reloads. */
  hidden: boolean
}

export const INITIAL_UPDATE_STATE: UpdateState = { status: "idle", hidden: false }

export type UpdateEvent =
  | { type: "available" }
  | { type: "later" }
  | { type: "refresh" }
  | { type: "updated" }
  | { type: "failed" }

export interface UpdateTransition {
  state: UpdateState
  /** True for exactly one event per ready worker: the one that asks to swap. */
  callUpdate: boolean
}

export function applyUpdateEvent(
  state: UpdateState,
  event: UpdateEvent,
): UpdateTransition {
  switch (event.type) {
    case "available":
      // An update already in flight must not be demoted back to ready.
      return state.status === "updating"
        ? { state, callUpdate: false }
        : {
            state: { status: "ready", hidden: false },
            callUpdate: false,
          }
    case "later":
      return state.status === "ready"
        ? {
            state: { status: "ready", hidden: true },
            callUpdate: false,
          }
        : { state, callUpdate: false }
    case "refresh":
      return state.status === "ready" && !state.hidden
        ? {
            state: { status: "updating", hidden: false },
            callUpdate: true,
          }
        : { state, callUpdate: false }
    case "updated":
      return { state: INITIAL_UPDATE_STATE, callUpdate: false }
    case "failed":
      return state.status === "updating"
        ? { state: { status: "ready", hidden: false }, callUpdate: false }
        : { state, callUpdate: false }
  }
}
