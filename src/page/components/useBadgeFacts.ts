import { useEffect, useState } from "react"

import type { BadgeFacts } from "@shared/badges"
import type { Profile } from "@shared/types"

import { readBadgeFacts } from "../api/badgeFacts"

export interface BadgeFactsState {
  /** `null` while the first read is in flight, or after it failed. */
  facts: BadgeFacts | null
  failed: boolean
}

/** One read of the badge facts, refetched when the profile changes. */
export function useBadgeFacts(profile: Profile): BadgeFactsState {
  const [facts, setFacts] = useState<BadgeFacts | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    setFacts(null)
    setFailed(false)

    void readBadgeFacts(profile)
      .then((next) => {
        if (active) {
          setFacts(next)
        }
      })
      .catch((error: unknown) => {
        console.error("[badges] Could not read the badge facts", error)

        if (active) {
          setFailed(true)
        }
      })

    return () => {
      active = false
    }
  }, [profile])

  return { facts, failed }
}
