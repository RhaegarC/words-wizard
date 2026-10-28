import type en from "../public/locales/en.json"

import type { Locale } from "./locale"

export type Dictionary = Record<string, string>

type CatalogueKey = keyof typeof en

/** A plural family (`home.streakDays_one/_other`) is called by its base key. */
type PluralBase<Key> = Key extends `${infer Base}_one` ? Base : never

/** Every key in `en.json`, plus plural bases. A key that is not in the English
 * catalogue does not exist, so a typo is a compile error rather than a runtime
 * fallback. */
export type MessageKey = CatalogueKey | PluralBase<CatalogueKey>

export type MessageParams = Record<string, string | number>

export type Translator = (key: MessageKey, params?: MessageParams) => string

export function interpolate(
  template: string,
  params: MessageParams = {},
): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : placeholder,
  )
}

/**
 * Build a translator for one locale. Lookup order is the active locale, then
 * English, then the key itself; only the last is a bug, so it warns in dev.
 * A numeric `count` param selects the `_one`/`_other` variant via
 * `Intl.PluralRules` (Chinese always resolves to `_other`).
 */
export function createTranslator(
  locale: Locale,
  dictionary: Dictionary,
  fallback: Dictionary,
): Translator {
  const pluralRules = new Intl.PluralRules(locale)

  return (key, params = {}) => {
    const template =
      lookup(dictionary, key, params, pluralRules) ??
      lookup(fallback, key, params, pluralRules)

    if (template === undefined) {
      if (import.meta.env.DEV) {
        console.warn(
          `[i18n] Missing message "${key}" for locale "${locale}"`,
        )
      }

      return key
    }

    return interpolate(template, params)
  }
}

function lookup(
  dictionary: Dictionary,
  key: string,
  params: MessageParams,
  pluralRules: Intl.PluralRules,
): string | undefined {
  if (typeof params.count === "number") {
    const category = pluralRules.select(params.count)
    const plural = dictionary[`${key}_${category}`]

    if (plural !== undefined) {
      return plural
    }
  }

  return dictionary[key]
}
