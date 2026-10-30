import { getAvatarSet } from "../content"
import { Outbox, OUTBOX_KEY } from "../api/outbox"
import { DEVICE_STORAGE_KEY } from "../api/ApiProgressProvider"
import { LOCAL_DATA_DISCARDED_KEY } from "../db/localData"
import { buildNewProfile } from "../domain/firstRun"
import type { ProgressProvider } from "@shared/provider"

/**
 * Dev-only helpers for the route table. They exercise the same provider the app
 * uses, so seeding is also a quick manual check of the profile write.
 */
export async function seedDevProfile(
  provider: ProgressProvider,
): Promise<void> {
  if (await provider.getProfile()) {
    return
  }

  const avatar = getAvatarSet()[0]

  if (avatar === undefined) {
    throw new Error("No avatar is loaded; fetch content before seeding")
  }

  await provider.createProfile(
    buildNewProfile(
      { characterName: "Alex", avatar: avatar.id },
      Date.now(),
      "en",
    ),
  )
}

/**
 * The server profile cannot be reset from the browser; this clears the local
 * half only (a pending commit and the device flags) and lets the next boot show
 * whatever D1 holds.
 */
export async function resetLocalData(): Promise<void> {
  new Outbox(window.localStorage).clear()
  window.localStorage.removeItem(OUTBOX_KEY)
  window.localStorage.removeItem(DEVICE_STORAGE_KEY)
  window.localStorage.removeItem(LOCAL_DATA_DISCARDED_KEY)
}
