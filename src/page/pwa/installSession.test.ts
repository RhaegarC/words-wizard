import { describe, expect, it, vi } from "vitest"

import { createInstallSession } from "./installSession"

describe("createInstallSession", () => {
  it("starts with the prompt open", () => {
    expect(createInstallSession().isDismissed()).toBe(false)
  })

  it("remembers a dismissal for the life of the session", () => {
    const session = createInstallSession()

    session.dismiss()

    expect(session.isDismissed()).toBe(true)
  })

  it("notifies subscribers once per dismissal", () => {
    const session = createInstallSession()
    const listener = vi.fn()
    const unsubscribe = session.subscribe(listener)

    session.dismiss()
    session.dismiss()
    unsubscribe()
    session.dismiss()

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
