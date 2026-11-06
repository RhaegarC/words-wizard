import { useCallback, useRef, useState } from "react"

import { progressProvider } from "../api/provider"
import type { Profile } from "@shared/types"

export type CareAction = "freeze" | "wake"

export type CareActionState = {
  pending: CareAction | null
  failed: boolean
  run: (action: CareAction) => void
}

/**
 * The one impure half of a Care Token spend. The Worker spends the token and
 * returns the fresh profile; the boot snapshot follows it. The ref closes the
 * same-tick double-tap window that `disabled` cannot.
 */
export function useCareAction(
  profile: Profile,
  onProfileUpdated: (profile: Profile) => void,
): CareActionState {
  const [pending, setPending] = useState<CareAction | null>(null)
  const [failed, setFailed] = useState(false)
  const busy = useRef(false)

  const run = useCallback(
    (action: CareAction) => {
      // A spend with no token is not offered, but a stale render could ask.
      if (busy.current || profile.careTokens <= 0) {
        return
      }

      busy.current = true
      setPending(action)
      setFailed(false)

      void progressProvider
        .applyCare(action === "freeze" ? "freeze" : "quickWake")
        .then(onProfileUpdated)
        .catch((reason: unknown) => {
          console.error("[character] Could not save the care action", reason)
          setFailed(true)
        })
        .finally(() => {
          busy.current = false
          setPending(null)
        })
    },
    [onProfileUpdated, profile.careTokens],
  )

  return { pending, failed, run }
}
