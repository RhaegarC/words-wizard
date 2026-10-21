import type { Metric, Profile, Progress } from "../domain/types"
import { defaultDb, type WordsWizardDB } from "./db"
import type { MetricName } from "./metrics"
import { validateSessionPayload } from "./payload"
import type {
  NewProfile,
  ProfilePatch,
  ProgressProvider,
  SessionCommitPayload,
} from "./provider"

/**
 * IndexedDB implementation of `ProgressProvider`. Every method takes the
 * calling context as data and returns a fresh object; nothing is cached, so a
 * reload always reads what the engine wrote.
 */
export class DexieProgressProvider implements ProgressProvider {
  constructor(private readonly db: WordsWizardDB = defaultDb) {}

  async getProfile(): Promise<Profile | null> {
    // v1 has no profile switcher: the lowest id is the only profile.
    return (await this.db.profiles.orderBy("id").first()) ?? null
  }

  async createProfile(profile: NewProfile): Promise<number> {
    return this.db.profiles.add(profile as Profile)
  }

  async updateProfile(id: number, patch: ProfilePatch): Promise<void> {
    const updated = await this.db.profiles.update(id, patch)

    if (updated === 0) {
      throw new Error(`Profile ${id} was not found`)
    }
  }

  async getProgress(
    profileId: number,
    wordId: string,
  ): Promise<Progress | null> {
    const row = await this.db.progress
      .where("[profileId+wordId]")
      .equals([profileId, wordId])
      .first()

    return row ?? null
  }

  async getAllProgress(profileId: number): Promise<Progress[]> {
    return this.db.progress.where("profileId").equals(profileId).toArray()
  }

  async commitSession(payload: SessionCommitPayload): Promise<void> {
    const issues = validateSessionPayload(payload)

    if (issues.length > 0) {
      throw new Error(`Invalid session payload: ${issues.join(", ")}`)
    }

    const { db } = this

    await db.transaction(
      "rw",
      db.progress,
      db.profiles,
      db.metrics,
      db.device,
      async () => {
        for (const row of payload.progress) {
          const existing = await db.progress
            .where("[profileId+wordId]")
            .equals([payload.profileId, row.wordId])
            .first()

          await db.progress.put({
            ...row,
            profileId: payload.profileId,
            ...(existing?.id === undefined ? {} : { id: existing.id }),
          })
        }

        const updated = await db.profiles.update(
          payload.profileId,
          payload.profile,
        )

        // The profile vanishing mid-commit is the loss case from PRD §8.4;
        // throwing rolls back the progress rows already written above.
        if (updated === 0) {
          throw new Error(`Profile ${payload.profileId} was not found`)
        }

        for (const [name, delta] of Object.entries(payload.metrics)) {
          if (delta === undefined) {
            continue
          }

          await addMetric(
            db,
            payload.profileId,
            name as MetricName,
            delta,
            payload.now,
          )
        }

        for (const [key, value] of Object.entries(payload.device ?? {})) {
          await db.device.put({ key, value })
        }
      },
    )
  }

  async incrementMetric(
    profileId: number,
    name: MetricName,
    delta = 1,
  ): Promise<void> {
    const { db } = this

    await db.transaction("rw", db.metrics, () =>
      addMetric(db, profileId, name, delta, Date.now()),
    )
  }

  async getMetrics(profileId: number): Promise<Metric[]> {
    return this.db.metrics.where("profileId").equals(profileId).sortBy("name")
  }

  async getDevice(key: string): Promise<unknown> {
    return (await this.db.device.get(key))?.value
  }

  async setDevice(key: string, value: unknown): Promise<void> {
    await this.db.device.put({ key, value })
  }
}

/**
 * Upsert one counter by `profileId + name` inside the caller's transaction.
 * `metrics` has no unique index, so the existing row is looked up first.
 */
async function addMetric(
  db: WordsWizardDB,
  profileId: number,
  name: MetricName,
  delta: number,
  now: number,
): Promise<void> {
  const existing = await db.metrics
    .where("profileId")
    .equals(profileId)
    .filter((metric) => metric.name === name)
    .first()

  if (existing?.id !== undefined) {
    await db.metrics.update(existing.id, {
      value: existing.value + delta,
      updatedAt: now,
    })

    return
  }

  await db.metrics.add({ profileId, name, value: delta, updatedAt: now })
}
