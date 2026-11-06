import { InstallPrompt } from "./InstallPrompt"

/**
 * Feature 15 fills the slot feature 11 reserved on Home. The card is the
 * repeated prompt; the same component's screen variant owns the steps.
 */
export function InstallPromptSlot() {
  return <InstallPrompt variant="card" />
}
