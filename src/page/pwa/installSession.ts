/**
 * "Dismissed once per session" lives here and nowhere else. The state is
 * deliberately in memory only: no provider, no device row, so a reload is a new
 * session and the prompt returns until the app is installed (PRD §8.5).
 */
export interface InstallSession {
  isDismissed(): boolean
  dismiss(): void
  subscribe(listener: () => void): () => void
}

/** The page-lifetime instance; a reload is a new session and a new prompt. */
export const installSession = createInstallSession()

export function createInstallSession(): InstallSession {
  let dismissed = false
  const listeners = new Set<() => void>()

  return {
    isDismissed: () => dismissed,
    dismiss: () => {
      if (dismissed) {
        return
      }

      dismissed = true

      for (const listener of listeners) {
        listener()
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
