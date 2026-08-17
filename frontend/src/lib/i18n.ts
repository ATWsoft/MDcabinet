/**
 * Minimal i18n without any dependency.
 *
 * The English wording is the lookup key (gettext style). That keeps the
 * components readable, makes English the natural fallback and reduces adding
 * a language to writing one more dictionary file.
 *
 * `t()`  – a plain string, with {placeholders}
 * `tn()` – a count-dependent string; Slovak needs three forms (1 / 2-4 / 5+)
 */

import { sk } from '@/locales/sk'

export const LOCALES = ['en', 'sk'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  sk: 'Slovenčina',
}

/** A translation is either one string or the plural forms [one, few, many]. */
export type Translation = string | [string, string, string]
export type Dictionary = Record<string, Translation>

const DICTIONARIES: Record<Locale, Dictionary> = {
  en: {},
  sk,
}

let active: Locale = DEFAULT_LOCALE

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function setActiveLocale(locale: Locale): void {
  active = locale
}

export function activeLocale(): Locale {
  return active
}

type Vars = Record<string, string | number>

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text

  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

/** Translates a string. The English text is the key. */
export function translate(locale: Locale, text: string, vars?: Vars): string {
  const entry = DICTIONARIES[locale][text]
  const resolved = typeof entry === 'string' ? entry : text

  return interpolate(resolved, vars)
}

/**
 * Count-dependent translation. English needs two forms, Slovak three:
 * 1 dokument / 2–4 dokumenty / 5+ dokumentov.
 */
export function translatePlural(
  locale: Locale,
  count: number,
  one: string,
  other: string,
  vars?: Vars,
): string {
  const entry = DICTIONARIES[locale][one]
  const allVars = { count, ...vars }

  if (Array.isArray(entry)) {
    const index = count === 1 ? 0 : count >= 2 && count <= 4 ? 1 : 2

    return interpolate(entry[index], allVars)
  }

  return interpolate(count === 1 ? one : other, allVars)
}

/** Number formatting that follows the active language. */
export function formatNumber(locale: Locale, value: number): string {
  return value.toLocaleString(locale === 'sk' ? 'sk-SK' : 'en-GB')
}
