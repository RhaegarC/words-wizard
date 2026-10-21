import { useEffect, useState } from "react"

import { progressProvider } from "../db"
import type { Progress } from "../domain/types"

export interface ProfileProgressState {
  /** `null` while the first read is in flight. */
  progress: readonly Progress[] | null
  failed: boolean
}

/** One read of a profile's progress, refetched when the profile changes. */
export function useProfileProgress(
  profileId: number | undefined,
): ProfileProgressState {
  const [progress, setProgress] = useState<readonly Progress[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    setProgress(null)
    setFailed(false)

    if (profileId === undefined) {
      setProgress([])
      return
    }

    void progressProvider
      .getAllProgress(profileId)
      .then((rows) => {
        if (active) {
          setProgress(rows)
        }
      })
      .catch((error: unknown) => {
        console.error("[progress] Could not read progress", error)

        if (active) {
          setFailed(true)
          setProgress([])
        }
      })

    return () => {
      active = false
    }
  }, [profileId])

  return { progress, failed }
}
