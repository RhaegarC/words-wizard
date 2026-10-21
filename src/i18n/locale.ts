export type Locale = "en" | "zh"

/** English word audio must stay on an English voice even in the Chinese UI. */
export const ENGLISH_SPEECH_LANG = "en-US"

/**
 * Pick the UI language from a BCP 47 tag. Any Chinese variant gets Chinese;
 * everything else — including a missing tag — gets English.
 */
export function defaultLocale(languageTag: string | undefined): Locale {
  return languageTag?.toLowerCase().startsWith("zh") ? "zh" : "en"
}

/** The `lang` value written to `<html>`, carrying the script subtag. */
export function htmlLang(locale: Locale): string {
  return locale === "zh" ? "zh-Hans" : "en"
}

/** The voice used for read-aloud UI copy and instructions. */
export function speechLangFor(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : ENGLISH_SPEECH_LANG
}
