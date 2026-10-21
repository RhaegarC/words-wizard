import { UpdateStatus } from "./UpdateStatus"

/**
 * Feature 15 fills the slot feature 14 reserved. Home and Settings each mount
 * it; the worker itself is registered once by `UpdateProvider`.
 */
export function UpdateStatusSlot() {
  return <UpdateStatus />
}
