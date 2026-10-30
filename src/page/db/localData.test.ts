import { describe, expect, it } from "vitest"

import {
  discardLegacyLocalData,
  LEGACY_DATABASE_NAME,
  LOCAL_DATA_DISCARDED_KEY,
  type IndexedDbFactoryLike,
} from "./localData"

class MemoryStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

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

describe("discardLegacyLocalData", () => {
  it("deletes the legacy database once and records that it did", async () => {
    const storage = new MemoryStorage()
    const fake = factory()

    const result = discardLegacyLocalData(storage, fake.value)
    fake.requests[0]!.onsuccess!(new Event("success"))

    await expect(result).resolves.toBe(true)
    expect(fake.names).toEqual([LEGACY_DATABASE_NAME])
    expect(storage.values.get(LOCAL_DATA_DISCARDED_KEY)).toBe("1")
  })

  it("does not delete again once the flag is set", async () => {
    const storage = new MemoryStorage()
    const fake = factory()

    storage.values.set(LOCAL_DATA_DISCARDED_KEY, "1")

    await expect(discardLegacyLocalData(storage, fake.value)).resolves.toBe(
      false,
    )
    expect(fake.names).toEqual([])
  })

  it("reports no deletion when the database cannot be reached", async () => {
    const storage = new MemoryStorage()
    const fake = factory()

    const result = discardLegacyLocalData(storage, fake.value)
    fake.requests[0]!.onerror!(new Event("error"))

    await expect(result).resolves.toBe(false)
  })

  it("leaves the flag unset when storage is blocked", async () => {
    const storage = new MemoryStorage()
    const fake = factory()

    storage.setItem = () => {
      throw new Error("blocked")
    }

    await expect(discardLegacyLocalData(storage, fake.value)).resolves.toBe(
      false,
    )
    expect(fake.names).toEqual([])
  })
})
