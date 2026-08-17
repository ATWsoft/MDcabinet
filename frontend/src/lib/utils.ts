/** Small helpers used across the UI. */

import { activeLocale, type Locale } from '@/lib/i18n'

/** Joins class names, dropping the empty ones. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

function intlLocale(locale: Locale = activeLocale()): string {
  return locale === 'sk' ? 'sk-SK' : 'en-GB'
}

/** "5 minutes ago", "yesterday", … Input is a MySQL DATETIME. */
export function timeAgo(value: string | null | undefined): string {
  if (!value) return ''

  const then = parseDate(value)
  if (!then) return ''

  const relative = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' })
  const seconds = Math.round((then.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)

  if (abs < 45) return relative.format(0, 'second')
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 2_592_000) return relative.format(Math.round(seconds / 86_400), 'day')
  if (abs < 31_536_000) return relative.format(Math.round(seconds / 2_592_000), 'month')

  return relative.format(Math.round(seconds / 31_536_000), 'year')
}

export function formatDateTime(value: string | null | undefined): string {
  const date = value ? parseDate(value) : null
  if (!date) return ''

  return new Intl.DateTimeFormat(intlLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/** MySQL returns "2026-08-16 18:36:26" – Safari cannot parse that as is. */
function parseDate(value: string): Date | null {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(normalized)

  return Number.isNaN(date.getTime()) ? null : date
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Delays a call – used by live search and autosave. */
export function debounce<T extends (...args: never[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
  debounced.cancel = () => timer && clearTimeout(timer)

  return debounced
}

/** Initials for the avatar. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export const isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)

/** "Ctrl" vs "⌘" depending on the platform. */
export const modKey = isMac ? '⌘' : 'Ctrl'
