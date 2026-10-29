import { defaultDb } from "./db"
import { DexieProgressProvider } from "./dexieProvider"

export { defaultDb, WordsWizardDB } from "./db"
export { DexieProgressProvider } from "./dexieProvider"

/** The app's only store. Screens import this, never Dexie directly. */
export const progressProvider = new DexieProgressProvider(defaultDb)
