import type { Profile } from "../domain/types"
import { hasEnglishVoice } from "../speech"

import { DEVICE_KEYS } from "./device"
import type { ProgressProvider } from "./provider"

export type BootResult =
  | { status: "present"; profile: Profile }
  | { status: "absent" }

export type SessionProfileResult =
  | { status: "present"; profile: Profile }
  | { status: "lost" }

/**
 * PRD §8.4: the boot asks for "a profile with a character". A record whose
 * character name is empty is treated as no profile, so character creation
 * repairs it rather than handing the app a nameless buddy.
 */
export function profileAtBoot(profile: Profile | null): BootResult {
  return profile?.characterName.trim()
    ? { status: "present", profile }
    : { status: "absent" }
}

/**
 * Pure half of the post-session re-read. Feature 09 reads the profile after a
 * commit and passes the result here; `lost` routes to the recovery entry point.
 */
export function verifyProfileAfterSession(
  profile: Profile | null,
): SessionProfileResult {
  return profile ? { status: "present", profile } : { status: "lost" }
}

/**
 * Read the profile once and record the boot. A missing profile in an installed
 * app is the abnormal case PRD §8.4 counts locally; a browser tab that has
 * never been set up is not.
 */
export async function checkProfileAtBoot(
  provider: ProgressProvider,
): Promise<BootResult> {
  const result = profileAtBoot(await provider.getProfile())

  if (result.status === "absent" && isInstalled()) {
    const recorded = await provider.getDevice(DEVICE_KEYS.profileAbsentAtBoot)
    await provider.setDevice(
      DEVICE_KEYS.profileAbsentAtBoot,
      typeof recorded === "number" ? recorded + 1 : 1,
    )
  }

  await provider.setDevice(DEVICE_KEYS.lastBootAt, Date.now())
  // Recorded locally so the session builder can exclude listen & choose on a
  // device whose loaded voice list has no English voice.
  await provider.setDevice(DEVICE_KEYS.speechAvailable, hasEnglishVoice())

  return result
}

export async function checkProfileAfterSession(
  provider: ProgressProvider,
): Promise<SessionProfileResult> {
  return verifyProfileAfterSession(await provider.getProfile())
}

/**
 * Ask the browser to make this origin's storage persistent, once. The recorded
 * result is reused on later boots, including a recorded `false`: asking again
 * every launch would not change the answer and delays nothing.
 */
export async function ensureStoragePersistence(
  provider: ProgressProvider,
): Promise<boolean> {
  const recorded = await provider.getDevice(DEVICE_KEYS.storagePersisted)

  if (typeof recorded === "boolean") {
    return recorded
  }

  let persisted = false

  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      persisted = await navigator.storage.persist()
    }
  } catch {
    // Storage Manager can throw in private or restricted contexts; persistence
    // is a supporting defence, not a requirement, so the app continues.
    persisted = false
  }

  await provider.setDevice(DEVICE_KEYS.storagePersisted, persisted)

  return persisted
}

/**
 * Install detection from PRD §8.5. Feature 15 owns the full install flow and
 * will extend this with the dismissed-prompt state; the check here only needs
 * to answer "is this the Home Screen app?".
 */
export function isInstalled(): boolean {
  if (typeof window === "undefined") {
    return false
  }

  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true

  return (
    iosStandalone ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  )
}
