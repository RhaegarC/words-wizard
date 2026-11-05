import { describe, expect, it } from "vitest"

import {
  LEGACY_DATABASE_NAME,
  deleteLegacyDatabase,
  type IndexedDbFactoryLike,
} from "../../db/localData"

/** A factory that records the name and lets the test settle the request. */
function factory() {
  const requests: Array<Record<string, ((event: Event) => void) | null>> = []
  const names: string[] = []

  const value: IndexedDbFactoryLike = {
    deleteDatabase(name) {
      names.push(name)
      const request = { onsuccess: null, onerror: null, onblocked: null }
      requests.push(request)
      return request
    },
  }

  return { value, names, requests }
}

describe("deleteLegacyDatabase", () => {
  it("reports deleted when the request succeeds", async () => {
    const fake = factory()

    const result = deleteLegacyDatabase(fake.value)
    fake.requests[0]!.onsuccess!(new Event("success"))

    await expect(result).resolves.toBe("deleted")
    expect(fake.names).toEqual([LEGACY_DATABASE_NAME])
  })

  it("reports blocked when another tab holds the database open", async () => {
    const fake = factory()

    const result = deleteLegacyDatabase(fake.value)
    fake.requests[0]!.onblocked!(new Event("blocked"))

    await expect(result).resolves.toBe("blocked")
  })

  it("reports unavailable when the request fails", async () => {
    const fake = factory()

    const result = deleteLegacyDatabase(fake.value)
    fake.requests[0]!.onerror!(new Event("error"))

    await expect(result).resolves.toBe("unavailable")
  })

  it("reports unavailable when IndexedDB does not exist", async () => {
    await expect(deleteLegacyDatabase(undefined)).resolves.toBe("unavailable")
  })

  it("reports unavailable when the call throws", async () => {
    const value: IndexedDbFactoryLike = {
      deleteDatabase() {
        throw new Error("denied")
      },
    }

    await expect(deleteLegacyDatabase(value)).resolves.toBe("unavailable")
  })
})
