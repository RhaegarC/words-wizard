import { useCallback, useRef, useState } from "react"

import { progressProvider } from "../db"
import { METRIC_NAMES } from "@shared/metrics"
import type { ProfilePatch } from "@shared/provider"
import { spendOnFreeze, spendOnQuickWake } from "@shared/character"
import type { Profile } from "@shared/types"

export type CareAction = "freeze" | "wake"

export type CareActionState = {
  pending: CareAction | null
  failed: boolean
  run: (action: CareAction) => void
}

/**
 * The one impure half of a Care Token spend: compute the pure profile, persist
 * it through feature 05, and hand the fresh profile back to the boot snapshot.
 * The ref closes the same-tick double-tap window that `disabled` cannot.
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
      const profileId = profile.id

      if (busy.current || profileId === undefined) {
        return
      }

      const now = Date.now()
      const outcome =
        action === "freeze"
          ? spendOnFreeze(profile, now)
          : spendOnQuickWake(profile, now)

      // A rejected spend changes nothing; the UI only offers legal actions.
      if (!outcome.spent) {
        return
      }

      busy.current = true
      setPending(action)
      setFailed(false)

      void progressProvider
        .updateProfile(profileId, toPatch(outcome.profile))
        .then(() => {
          onProfileUpdated({ ...outcome.profile, id: profileId })

          if (action === "wake") {
            void progressProvider
              .incrementMetric(profileId, METRIC_NAMES.revivalQuickWake)
              .catch((reason: unknown) => {
                console.warn("[character] Could not record the wake", reason)
              })
          }
        })
        .catch((reason: unknown) => {
          console.error("[character] Could not save the care action", reason)
          setFailed(true)
        })
        .finally(() => {
          busy.current = false
          setPending(null)
        })
    },
    [onProfileUpdated, profile],
  )

  return { pending, failed, run }
}

/** `id` and `createdAt` are fixed; everything else is a legal patch. */
function toPatch(profile: Profile): ProfilePatch {
  const { id: _id, createdAt: _createdAt, ...patch } = profile

  return patch
}
