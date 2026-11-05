/**
 * Mission 1 stored the child's profile, progress, and counters in
 * `WordsWizardDB` (IndexedDB). Feature 27 reads that store once and imports it
 * into the signed-in account; it is deleted only after a successful import or
 * an explicit discard.
 *
 * The reader is raw IndexedDB, not Dexie: Dexie is no longer a dependency, and
 * a missing database must be reported without being created. Opening with no
 * version is what makes an absent database an upgrade request, which this
 * module aborts rather than allowing the browser to create an empty store.
 */

export const LEGACY_DATABASE_NAME = "WordsWizardDB"

/** The Mission 1 v1 store set; anything else is not this product's data. */
const LEGACY_STORES = ["profiles", "progress", "metrics"] as const

export type LegacyRecord = Record<string, unknown>

export type LegacyReadResult =
  | { readonly status: "absent" }
  | { readonly status: "unreadable" }
  | {
      readonly status: "ready"
      readonly profiles: LegacyRecord[]
      readonly progress: LegacyRecord[]
      readonly metrics: LegacyRecord[]
    }

export type LegacyDeleteResult = "deleted" | "blocked" | "unavailable"

export interface IndexedDbFactoryLike {
  deleteDatabase(name: string): {
    onsuccess: ((event: Event) => void) | null
    onerror: ((event: Event) => void) | null
    onblocked: ((event: Event) => void) | null
  }
}

function defaultFactory(): IDBFactory | undefined {
  return typeof indexedDB === "undefined" ? undefined : indexedDB
}

function defaultDeleteFactory(): IndexedDbFactoryLike | undefined {
  return typeof indexedDB === "undefined"
    ? undefined
    : (indexedDB as unknown as IndexedDbFactoryLike)
}

function readAll(store: IDBObjectStore): Promise<LegacyRecord[]> {
  return new Promise((resolve, reject) => {
    const request = store.getAll()

    request.onsuccess = () =>
      resolve((request.result as LegacyRecord[] | undefined) ?? [])
    request.onerror = () => reject(request.error ?? new Error("read failed"))
  })
}

async function readStores(
  db: IDBDatabase,
  settle: (result: LegacyReadResult) => void,
): Promise<void> {
  try {
    const missing = LEGACY_STORES.some(
      (name) => !db.objectStoreNames.contains(name),
    )

    if (missing) {
      settle({ status: "unreadable" })
      return
    }

    // One transaction over all three stores keeps the three reads consistent
    // with each other: a concurrent write cannot land between them.
    const transaction = db.transaction([...LEGACY_STORES], "readonly")
    const [profiles, progress, metrics] = await Promise.all([
      readAll(transaction.objectStore("profiles")),
      readAll(transaction.objectStore("progress")),
      readAll(transaction.objectStore("metrics")),
    ])

    settle({ status: "ready", profiles, progress, metrics })
  } catch {
    settle({ status: "unreadable" })
  } finally {
    db.close()
  }
}

/**
 * Read the Mission 1 database without creating it.
 *
 * `onupgradeneeded` fires when the database does not exist; the version-change
 * transaction is aborted and the result is `absent`. A database with the wrong
 * stores (for example the Figma prototype's `profiles`-only one) is
 * `unreadable`, not empty.
 */
export function readLegacyLocalData(
  factory: IDBFactory | undefined = defaultFactory(),
): Promise<LegacyReadResult> {
  if (factory === undefined) {
    return Promise.resolve({ status: "absent" })
  }

  return new Promise<LegacyReadResult>((resolve) => {
    let settled = false

    const settle = (result: LegacyReadResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    let request: IDBOpenDBRequest

    try {
      request = factory.open(LEGACY_DATABASE_NAME)
    } catch {
      settle({ status: "unreadable" })
      return
    }

    request.onupgradeneeded = () => {
      // Do not let the browser create an empty `WordsWizardDB`.
      try {
        request.transaction?.abort()
      } catch {
        // Already aborted or not abortable; the result is absent either way.
      }

      settle({ status: "absent" })
    }
    request.onerror = () => settle({ status: "unreadable" })
    request.onblocked = () => settle({ status: "unreadable" })
    request.onsuccess = () => {
      const db = request.result
      // Another tab may ask for a version change; release the connection so its
      // discard is not blocked forever.
      db.onversionchange = () => db.close()
      void readStores(db, settle)
    }
  })
}

/**
 * Delete the legacy database. `blocked` means another tab still holds it open:
 * the import has already succeeded, and the card tells the child to close the
 * other tab and retry.
 */
export function deleteLegacyDatabase(
  factory: IndexedDbFactoryLike | undefined = defaultDeleteFactory(),
): Promise<LegacyDeleteResult> {
  if (factory === undefined) {
    return Promise.resolve("unavailable")
  }

  return new Promise<LegacyDeleteResult>((resolve) => {
    let request: ReturnType<IndexedDbFactoryLike["deleteDatabase"]>

    try {
      request = factory.deleteDatabase(LEGACY_DATABASE_NAME)
    } catch {
      resolve("unavailable")
      return
    }

    request.onsuccess = () => resolve("deleted")
    request.onerror = () => resolve("unavailable")
    request.onblocked = () => resolve("blocked")
  })
}
