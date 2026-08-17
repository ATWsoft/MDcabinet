import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Languages, LogOut, Menu, Monitor, Moon, Search, Settings, Sun, X } from 'lucide-react'

import { api, bootstrap } from '@/lib/api'
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n'
import { cx, initials, modKey } from '@/lib/utils'
import { useAuth } from '@/state/auth'
import { useI18n } from '@/state/locale'
import { useTheme, type ThemeMode } from '@/state/theme'
import { Sidebar } from '@/components/Sidebar'
import { SearchPalette } from '@/components/SearchPalette'

export function Layout() {
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()

  // Ctrl/⌘+K opens search from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => setSidebarOpen(false), [location.pathname])

  return (
    <div className="flex h-full flex-col bg-ink-50 dark:bg-ink-950">
      <Header onMenu={() => setSidebarOpen(true)} onSearch={() => setSearchOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-ink-200 bg-white lg:block dark:border-ink-800 dark:bg-ink-900">
          <Sidebar />
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-ink-950/40" onClick={() => setSidebarOpen(false)} aria-hidden />
            <aside className="relative h-full w-72 max-w-[85vw] animate-slide-up bg-white shadow-xl dark:bg-ink-900">
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label={t('Close menu')}
                className="absolute right-2 top-2 rounded-lg p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                <X className="h-4 w-4" />
              </button>
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

function Header({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { t } = useI18n()

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 bg-white px-3 sm:px-4 dark:border-ink-800 dark:bg-ink-900">
      <button
        onClick={onMenu}
        aria-label={t('Open menu')}
        className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden dark:hover:bg-ink-800"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link to="/" className="flex items-center gap-2.5 pr-2">
        <Logo />
        <span className="hidden text-[15px] font-semibold tracking-tight text-ink-900 sm:block dark:text-white">
          {bootstrap.appName}
        </span>
      </Link>

      <button
        onClick={onSearch}
        className="ml-auto flex h-9 max-w-md flex-1 items-center gap-2.5 rounded-lg bg-ink-100 px-3 text-sm text-ink-500 transition-colors hover:bg-ink-200/70 sm:ml-4 dark:bg-ink-800 dark:text-ink-400 dark:hover:bg-ink-700"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">{t('Search…')}</span>
        <kbd className="ml-auto hidden rounded border border-ink-300 px-1.5 py-0.5 text-[11px] sm:block dark:border-ink-600">
          {modKey}+K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:ml-0">
        <LocaleToggle />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}

function Logo() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-600 text-white shadow-sm">
      <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
        <rect x="4" y="6" width="24" height="8" rx="2" fill="currentColor" opacity="0.55" />
        <rect x="4" y="18" width="24" height="8" rx="2" fill="currentColor" />
        <circle cx="16" cy="10" r="1.6" fill="#4338ca" />
        <circle cx="16" cy="22" r="1.6" fill="#4338ca" />
      </svg>
    </span>
  )
}

/**
 * Quick language switch in the header. For a signed-in user the choice is also
 * written to the account, so there is a single source of truth and the switch
 * survives a reload.
 */
function LocaleToggle() {
  const { t, locale, setLocale } = useI18n()
  const { user, refresh } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const choose = (next: Locale) => {
    setOpen(false)
    if (next === locale) return

    setLocale(next)

    if (user) {
      // Fire and forget – the interface has already switched.
      void api.auth
        .updateProfile({ name: user.name, locale: next })
        .then(() => refresh())
        .catch(() => undefined)
    }
  }

  useEffect(() => {
    if (!open) return

    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)

    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        title={t('Language')}
        aria-label={t('Language')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white"
      >
        <Languages className="h-4 w-4" />
        <span className="text-[11px] font-semibold uppercase">{locale}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-40 animate-slide-up overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-ink-200 dark:bg-ink-800 dark:ring-ink-700"
        >
          {LOCALES.map((value: Locale) => (
            <button
              key={value}
              onClick={() => choose(value)}
              className={cx(
                'flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors',
                value === locale
                  ? 'bg-accent-50 font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-200'
                  : 'text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700',
              )}
            >
              {LOCALE_NAMES[value]}
              <span className="text-[11px] uppercase text-ink-400">{value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { t } = useI18n()
  const { mode, setMode } = useTheme()

  const next: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' }
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor
  const label = mode === 'light' ? t('Light theme') : mode === 'dark' ? t('Dark theme') : t('Follow system')

  return (
    <button
      onClick={() => setMode(next[mode])}
      title={t('{theme} – click to switch', { theme: label })}
      aria-label={label}
      className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function UserMenu() {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)

    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold text-white ring-2 ring-transparent transition hover:ring-ink-200 dark:hover:ring-ink-700"
        style={{ backgroundColor: user.avatarColor }}
        title={user.name}
      >
        {initials(user.name)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-60 animate-slide-up overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-ink-200 dark:bg-ink-800 dark:ring-ink-700"
        >
          <div className="border-b border-ink-100 px-4 py-3 dark:border-ink-700">
            <p className="truncate text-sm font-medium text-ink-900 dark:text-white">{user.name}</p>
            <p className="truncate text-[13px] text-ink-500 dark:text-ink-400">{user.email}</p>
            {user.role === 'admin' && (
              <span className="mt-1.5 inline-block rounded bg-accent-100 px-1.5 py-0.5 text-[11px] font-medium text-accent-700 dark:bg-accent-900/50 dark:text-accent-200">
                {t('administrator')}
              </span>
            )}
          </div>

          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 transition-colors hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700"
          >
            <Settings className="h-4 w-4 text-ink-400" />
            {t('Account settings')}
          </Link>

          <button
            onClick={() => void logout()}
            className={cx(
              'flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 transition-colors',
              'hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700',
            )}
          >
            <LogOut className="h-4 w-4 text-ink-400" />
            {t('Sign out')}
          </button>
        </div>
      )}
    </div>
  )
}
