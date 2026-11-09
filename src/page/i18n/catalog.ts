import en from "./locales/en.json"
import zh from "./locales/zh.json"

import type { Locale } from "./locale"
import type { Dictionary } from "./messages"

/**
 * Both dictionaries, statically imported so `t()` is synchronous and the
 * strings are part of the offline bundle. They live under `i18n/` because
 * Vite refuses to import from `public/`; the build emits the same files to
 * `dist/locales/`, where the service worker precaches them.
 */
export const CATALOG: Record<Locale, Dictionary> = { en, zh }
