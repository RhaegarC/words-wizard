import en from "../public/locales/en.json"
import zh from "../public/locales/zh.json"

import type { Locale } from "./locale"
import type { Dictionary } from "./messages"

/**
 * Both dictionaries, statically imported so `t()` is synchronous and the
 * strings are part of the offline bundle. The same files are copied to
 * `dist/locales/` from `public/`, where the service worker can precache them.
 */
export const CATALOG: Record<Locale, Dictionary> = { en, zh }
