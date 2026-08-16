/** Drobné pomôcky používané naprieč UI. */

/** Spojenie tried s odfiltrovaním prázdnych hodnôt. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

const RELATIVE = new Intl.RelativeTimeFormat('sk', { numeric: 'auto' })
const FULL = new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' })

/** "pred 5 minútami", "včera", … Vstup je MySQL DATETIME. */
export function timeAgo(value: string | null | undefined): string {
  if (!value) return ''

  const then = parseDate(value)
  if (!then) return ''

  const seconds = Math.round((then.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)

  if (abs < 45) return 'práve teraz'
  if (abs < 3600) return RELATIVE.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return RELATIVE.format(Math.round(seconds / 3600), 'hour')
  if (abs < 2_592_000) return RELATIVE.format(Math.round(seconds / 86_400), 'day')
  if (abs < 31_536_000) return RELATIVE.format(Math.round(seconds / 2_592_000), 'month')

  return RELATIVE.format(Math.round(seconds / 31_536_000), 'year')
}

export function formatDateTime(value: string | null | undefined): string {
  const date = value ? parseDate(value) : null
  return date ? FULL.format(date) : ''
}

/** MySQL vracia "2026-08-16 18:36:26" – Safari to bez prerobenia neprečíta. */
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

/** Odloží volanie funkcie – používa sa pri hľadaní za behu a autosave. */
export function debounce<T extends (...args: never[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
  debounced.cancel = () => timer && clearTimeout(timer)

  return debounced
}

/**
 * Slovenské skloňovanie podľa počtu: 1 slovo / 2–4 slová / 5+ slov.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one
  if (count >= 2 && count <= 4) return few

  return many
}

/** "46 slov" aj s číslom naformátovaným po slovensky. */
export function pluralize(count: number, one: string, few: string, many: string): string {
  return `${count.toLocaleString('sk-SK')} ${plural(count, one, few, many)}`
}

/** Iniciály pre avatar. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export const isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)

/** "Ctrl" vs "⌘" podľa platformy. */
export const modKey = isMac ? '⌘' : 'Ctrl'
