import { useEffect, useState } from "react"

import { progressProvider } from "../api/provider"
import type { PackIntroduction } from "@shared/me"
import type { Progress } from "@shared/types"

export interface ProfileProgressState {
  /** `null` while the first read is in flight. */
  progress: readonly Progress[] | null
  /** `null` while the first read is in flight. */
  introductions: readonly PackIntroduction[] | null
  failed: boolean
}

/** One read of a profile's progress, refetched when the profile changes. */
export function useProfileProgress(
  profileId: string,
): ProfileProgressState {
  const [progress, setProgress] = useState<readonly Progress[] | null>(null)
  const [introductions, setIntroductions] = useState<
    readonly PackIntroduction[] | null
  >(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    setProgress(null)
    setIntroductions(null)
    setFailed(false)

    void Promise.all([
      progressProvider.getAllProgress(profileId),
      progressProvider.getIntroductions(profileId),
    ])
      .then(([rows, introRows]) => {
        if (active) {
          setProgress(rows)
          setIntroductions(introRows)
        }
      })
      .catch((error: unknown) => {
        console.error("[progress] Could not read progress", error)

        if (active) {
          setFailed(true)
          setProgress([])
          setIntroductions([])
        }
      })

    return () => {
      active = false
    }
  }, [profileId])

  return { progress, introductions, failed }
}
