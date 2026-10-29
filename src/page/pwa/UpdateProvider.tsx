import { createContext, useContext, type ReactNode } from "react"

import {
  useServiceWorkerUpdate,
  type ServiceWorkerUpdate,
} from "./useServiceWorkerUpdate"

const UpdateContext = createContext<ServiceWorkerUpdate | null>(null)

/**
 * Mounted once at the app root, so the worker registers on every route — not
 * only when Home or Settings happens to render the notice.
 */
export function UpdateProvider({ children }: { children: ReactNode }) {
  const update = useServiceWorkerUpdate()

  return (
    <UpdateContext.Provider value={update}>{children}</UpdateContext.Provider>
  )
}

export function useUpdateNotice(): ServiceWorkerUpdate {
  const value = useContext(UpdateContext)

  if (!value) {
    throw new Error("useUpdateNotice must be used inside UpdateProvider")
  }

  return value
}
