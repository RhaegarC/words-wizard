import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { CATALOG } from "./catalog"
import { defaultLocale, htmlLang, type Locale } from "./locale"
import { createTranslator, type Translator } from "./messages"

const STORAGE_KEY = "words-wizard.locale"

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translator
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

/**
 * The pre-profile language (creation, boot) and the persistence layer for the
 * toggle. Once the profile is read, App treats `Profile.locale` as the
 * authority and calls `setLocale` when the two disagree.
 */
function storedLocale(): Locale | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)

    return value === "en" || value === "zh" ? value : null
  } catch {
    return null
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(
    () => storedLocale() ?? defaultLocale(navigator.language),
  )

  const t = useMemo(
    () => createTranslator(locale, CATALOG[locale], CATALOG.en),
    [locale],
  )

  useEffect(() => {
    document.documentElement.lang = htmlLang(locale)
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)

    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // A blocked storage area only costs persistence, not the language switch.
    }
  }, [])

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext)

  if (!value) {
    throw new Error("useLocale must be used inside LocaleProvider")
  }

  return value
}
