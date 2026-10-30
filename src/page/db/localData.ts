/**
 * Mission 1 stored progress in IndexedDB. Mission 2 replaced that store with
 * D1, and no migration is attempted: there are no production users, and a
 * partial import would be worse than a clear reset.
 *
 * The database is deleted once, guarded by a `localStorage` flag, and the app
 * shows a notice that the old local progress is not carried over.
 */

export const LOCAL_DATA_DISCARDED_KEY = "words-wizard.localDataDiscarded"
export const LEGACY_DATABASE_NAME = "WordsWizardDB"

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface IndexedDbFactoryLike {
  deleteDatabase(name: string): {
    onsuccess: ((event: Event) => void) | null
    onerror: ((event: Event) => void) | null
    onblocked: ((event: Event) => void) | null
  }
}

/**
 * Delete the Mission 1 database if it has not been discarded before. Returns
 * true only when the deletion ran, so the caller can show the notice once.
 */
export async function discardLegacyLocalData(
  storage: StorageLike = window.localStorage,
  factory: IndexedDbFactoryLike | undefined =
    typeof indexedDB === "undefined"
      ? undefined
      : (indexedDB as unknown as IndexedDbFactoryLike),
): Promise<boolean> {
  try {
    if (storage.getItem(LOCAL_DATA_DISCARDED_KEY) === "1") {
      return false
    }
  } catch {
    return false
  }

  // Mark before the deletion so a crash mid-delete is not a notice on every
  // boot; there is nothing to preserve either way.
  try {
    storage.setItem(LOCAL_DATA_DISCARDED_KEY, "1")
  } catch {
    return false
  }

  if (factory === undefined) {
    return false
  }

  return new Promise<boolean>((resolve) => {
    let request: ReturnType<IndexedDbFactoryLike["deleteDatabase"]>

    try {
      request = factory.deleteDatabase(LEGACY_DATABASE_NAME)
    } catch {
      resolve(false)
      return
    }

    request.onsuccess = () => resolve(true)
    request.onerror = () => resolve(false)
    request.onblocked = () => resolve(false)
  })
}
