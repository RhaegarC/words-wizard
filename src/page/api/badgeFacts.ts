import { badgeFacts, type BadgeFacts } from "@shared/badges"
import type { Profile } from "@shared/types"

import { progressProvider } from "./provider"

/**
 * Feature 37. One read of the facts behind the badge shelf. `getMetrics` is
 * answered from the cached `/v1/me` snapshot; the exam states are the only
 * extra request, and a session never changes them.
 */
export async function readBadgeFacts(profile: Profile): Promise<BadgeFacts> {
  const [metrics, exams] = await Promise.all([
    progressProvider.getMetrics(profile.id),
    progressProvider.getExams(),
  ])

  return badgeFacts({ profile, metrics, exams })
}
