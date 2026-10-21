/**
 * Temporary stand-in for the Dexie-backed profile presence that feature 05
 * supplies. It exists only in a dev build, so a route can be inspected before
 * character creation is implemented (feature 06).
 */
const DEV_PROFILE_KEY = "words-wizard.dev-profile"

export function readDevProfile(): boolean {
  if (!import.meta.env.DEV || typeof sessionStorage === "undefined") {
    return false
  }

  return sessionStorage.getItem(DEV_PROFILE_KEY) === "1"
}

export function writeDevProfile(present: boolean): void {
  if (!import.meta.env.DEV || typeof sessionStorage === "undefined") {
    return
  }

  if (present) {
    sessionStorage.setItem(DEV_PROFILE_KEY, "1")
  } else {
    sessionStorage.removeItem(DEV_PROFILE_KEY)
  }
}
