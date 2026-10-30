import type { Metric } from "@shared/types"

import { progressProvider } from "../api/provider"
import { DEVICE_STORAGE_KEY } from "../api/ApiProgressProvider"

export interface ApiDiagnostics {
  progress: number
  introductions: number
  device: number
  metrics: readonly Metric[]
}

/**
 * Counts behind Settings diagnostics. Everything comes from the `/v1/me`
 * snapshot plus the local device flags; there is no local progress store to
 * inspect any more, and the child's name is never printed here.
 */
export async function readDiagnostics(
  profileId: string,
  storage: Pick<Storage, "getItem"> = window.localStorage,
): Promise<ApiDiagnostics> {
  const [progress, introductions, metrics] = await Promise.all([
    progressProvider.getAllProgress(profileId),
    progressProvider.getIntroductions(profileId),
    progressProvider.getMetrics(profileId),
  ])

  return {
    progress: progress.length,
    introductions: introductions.length,
    device: countDeviceFlags(storage),
    metrics,
  }
}

function countDeviceFlags(storage: Pick<Storage, "getItem">): number {
  try {
    const raw = storage.getItem(DEVICE_STORAGE_KEY)

    if (raw === null) {
      return 0
    }

    const parsed: unknown = JSON.parse(raw)

    return typeof parsed === "object" && parsed !== null
      ? Object.keys(parsed).length
      : 0
  } catch {
    return 0
  }
}
