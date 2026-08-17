import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'

import { setRequestLocale } from '@/lib/api'
import {
  DEFAULT_LOCALE, formatNumber, isLocale, setActiveLocale, translate, translatePlural,
  type Locale,
} from '@/lib/i18n'

const STORAGE_KEY = 'mdcabinet.locale'

interface LocaleContextValue {
  locale: Locale
  /** Translate: t('Save') */
  t: (text: string, vars?: Record<string, string | number>) => string
  /** Count-dependent translate: tn(n, '{count} document', '{count} documents') */
  tn: (count: number, one: string, other: string, vars?: Record<string, string | number>) => string
  /** Number formatted for the active language. */
  n: (value: number) => string
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

/**
 * The starting language is the last explicit choice, otherwise English.
 *
 * The browser preference is deliberately not used: a predictable default is
 * worth more than guessing, and switching takes one click in the header.
 * A signed-in user's own setting overrides this (see AuthProvider).
 */
function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    /* private browsing – fall through to the default */
  }

  return DEFAULT_LOCALE
}

// Applied at module load, before the first render, so that even the very first
// API request carries the right X-Locale header.
const INITIAL_LOCALE = initialLocale()
setActiveLocale(INITIAL_LOCALE)
setRequestLocale(INITIAL_LOCALE)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(INITIAL_LOCALE)

  // Keep the i18n module, the API header and <html lang> in sync.
  useEffect(() => {
    setActiveLocale(locale)
    setRequestLocale(locale)
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* not fatal – only the persistence is lost */
    }
    setActiveLocale(next)
    setRequestLocale(next)
    setLocaleState(next)
  }, [])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: (text, vars) => translate(locale, text, vars),
      tn: (count, one, other, vars) => translatePlural(locale, count, one, other, vars),
      n: (input) => formatNumber(locale, input),
      setLocale,
    }),
    [locale, setLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useI18n(): LocaleContextValue {
  const context = useContext(LocaleContext)
  if (!context) throw new Error('useI18n must be used inside <LocaleProvider>')

  return context
}
