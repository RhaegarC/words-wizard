import { describe, expect, it } from "vitest"

import {
  applyUpdateEvent,
  INITIAL_UPDATE_STATE,
  type UpdateState,
} from "./update"

const READY: UpdateState = { status: "ready", hidden: false }
const UPDATING: UpdateState = { status: "updating", hidden: false }

describe("applyUpdateEvent", () => {
  it("shows the prompt when a new worker is waiting", () => {
    expect(applyUpdateEvent(INITIAL_UPDATE_STATE, { type: "available" })).toEqual(
      { state: READY, callUpdate: false },
    )
  })

  it("keeps the old worker when the child chooses Later", () => {
    expect(applyUpdateEvent(READY, { type: "later" })).toEqual({
      state: { status: "ready", hidden: true },
      callUpdate: false,
    })
  })

  it("calls update exactly once when the child refreshes", () => {
    expect(applyUpdateEvent(READY, { type: "refresh" })).toEqual({
      state: UPDATING,
      callUpdate: true,
    })
    expect(applyUpdateEvent(UPDATING, { type: "refresh" })).toEqual({
      state: UPDATING,
      callUpdate: false,
    })
  })

  it("ignores Refresh before a worker is ready", () => {
    expect(applyUpdateEvent(INITIAL_UPDATE_STATE, { type: "refresh" })).toEqual({
      state: INITIAL_UPDATE_STATE,
      callUpdate: false,
    })
  })

  it("shows a new prompt over a hidden one when another worker arrives", () => {
    expect(
      applyUpdateEvent({ status: "ready", hidden: true }, { type: "available" }),
    ).toEqual({ state: READY, callUpdate: false })
  })

  it("returns to idle once the new worker has taken over", () => {
    expect(applyUpdateEvent(UPDATING, { type: "updated" })).toEqual({
      state: INITIAL_UPDATE_STATE,
      callUpdate: false,
    })
  })

  it("offers a retry when the update fails", () => {
    expect(applyUpdateEvent(UPDATING, { type: "failed" })).toEqual({
      state: READY,
      callUpdate: false,
    })
  })
})
