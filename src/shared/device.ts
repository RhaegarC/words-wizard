/**
 * Device-level keys from PRD §8.3. A `Device` row is not scoped to a profile:
 * it describes this browser install, so it survives profile loss.
 */
export const DEVICE_KEYS = {
  installed: "installed",
  storagePersisted: "storagePersisted",
  speechAvailable: "speechAvailable",
  profileAbsentAtBoot: "profileAbsentAtBoot",
  lastBootAt: "lastBootAt",
} as const

export type DeviceKey = (typeof DEVICE_KEYS)[keyof typeof DEVICE_KEYS]
