/**
 * Chromium fires `beforeinstallprompt` once, early, and the event may only be
 * used once. main.tsx captures it before React mounts; the install card calls
 * it from a button. Nothing here persists: a reload re-captures or does not.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable"

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

/**
 * Start listening. Returns an unsubscribe function so tests and a future
 * teardown can detach without a page reload.
 */
export function listenForBeforeInstallPrompt(
  target: Pick<Window, "addEventListener" | "removeEventListener">,
): () => void {
  const handler = (event: Event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent

    for (const listener of listeners) {
      listener()
    }
  }

  target.addEventListener("beforeinstallprompt", handler)

  return () => target.removeEventListener("beforeinstallprompt", handler)
}

export function deferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferred
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Show the browser's native prompt, if one was captured and not yet used. */
export async function promptForInstall(): Promise<InstallOutcome> {
  const event = deferred

  if (event === null) {
    return "unavailable"
  }

  deferred = null

  try {
    await event.prompt()
    const choice = await event.userChoice

    return choice.outcome
  } catch {
    return "unavailable"
  }
}
