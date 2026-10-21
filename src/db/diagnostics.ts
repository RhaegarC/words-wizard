import { defaultDb, type WordsWizardDB } from "./db"

export interface DbDiagnostics {
  profiles: number
  progress: number
  metrics: number
  device: number
  profileId: number | null
}

/**
 * Row counts for Settings diagnostics (feature 14). Deliberately raw: it exists
 * to answer "is anything actually stored?" when a device loses its data.
 */
export async function readDiagnostics(
  db: WordsWizardDB = defaultDb,
): Promise<DbDiagnostics> {
  const profile = await db.profiles.orderBy("id").first()

  return {
    profiles: await db.profiles.count(),
    progress: await db.progress.count(),
    metrics: await db.metrics.count(),
    device: await db.device.count(),
    profileId: profile?.id ?? null,
  }
}
