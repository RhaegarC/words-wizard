import { useCallback, useEffect, useRef, useState } from "react"
import { useRegisterSW } from "virtual:pwa-register/react"

import {
  applyUpdateEvent,
  INITIAL_UPDATE_STATE,
  type UpdateEvent,
  type UpdateState,
} from "@shared/update"

export interface ServiceWorkerUpdate {
  state: UpdateState
  refresh: () => void
  later: () => void
}

/**
 * The one registration point for the generated worker. `registerType: "prompt"`
 * means the worker waits; this hook only reports it, and the Refresh button is
 * the single place that asks the plugin to take it over.
 */
export function useServiceWorkerUpdate(): ServiceWorkerUpdate {
  const [state, setState] = useState<UpdateState>(INITIAL_UPDATE_STATE)
  const stateRef = useRef<UpdateState>(INITIAL_UPDATE_STATE)
  const updateWorker = useRef<
    ((reloadPage?: boolean) => Promise<void>) | null
  >(null)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    updateWorker.current = updateServiceWorker
  }, [updateServiceWorker])

  const dispatch = useCallback((event: UpdateEvent) => {
    const transition = applyUpdateEvent(stateRef.current, event)

    if (transition.state !== stateRef.current) {
      stateRef.current = transition.state
      setState(transition.state)
    }

    if (transition.callUpdate) {
      void updateWorker
        .current?.(true)
        .catch((reason: unknown) => {
          console.error("[pwa] Could not activate the update", reason)

          const failed = applyUpdateEvent(stateRef.current, { type: "failed" })
          stateRef.current = failed.state
          setState(failed.state)
        })
    }
  }, [])

  useEffect(() => {
    if (needRefresh) {
      dispatch({ type: "available" })
    }
  }, [dispatch, needRefresh])

  const refresh = useCallback(() => dispatch({ type: "refresh" }), [dispatch])
  const later = useCallback(() => dispatch({ type: "later" }), [dispatch])

  return { state, refresh, later }
}
