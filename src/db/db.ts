import Dexie, { type Table } from "dexie"

import type { Device, Metric, Profile, Progress } from "../domain/types"

/**
 * The on-device store, exactly as PRD §8.3. Version 1 is the whole schema for
 * v1; there are no migrations beyond it.
 *
 * The Figma prototype opened a database with the same name and a different
 * v1 (`profiles` only). Dexie refuses to reinterpret a version it did not
 * create, so a developer who ran the prototype must clear this origin's site
 * data once. Demo records are deliberately not migrated.
 */
export class WordsWizardDB extends Dexie {
  profiles!: Table<Profile, number>
  progress!: Table<Progress, number>
  metrics!: Table<Metric, number>
  device!: Table<Device, string>

  constructor(name = "WordsWizardDB") {
    super(name)

    this.version(1).stores({
      profiles: "++id, name, createdAt",
      progress:
        "++id, profileId, wordId, status, nextReviewAt, &[profileId+wordId]",
      metrics: "++id, profileId, name, updatedAt",
      device: "key",
    })
  }
}

export const defaultDb = new WordsWizardDB()
