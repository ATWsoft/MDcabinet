import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, RefreshCw } from 'lucide-react'

import { ApiError, api } from '@/lib/api'
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n'
import { cx, formatDateTime, initials } from '@/lib/utils'
import { useAuth } from '@/state/auth'
import { useI18n } from '@/state/locale'
import { useTheme, type ThemeMode } from '@/state/theme'
import { Button, Input, Select, useToast } from '@/components/ui'

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6']

export function SettingsPage() {
  const { t, locale, setLocale } = useI18n()
  const { user, refresh } = useAuth()
  const { mode, setMode } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [name, setName] = useState(user?.name ?? '')
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? AVATAR_COLORS[0])
  const [language, setLanguage] = useState<Locale>(locale)
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [savingPassword, setSavingPassword] = useState(false)

  if (!user) return null

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      // Switch the interface first so the confirmation already arrives
      // in the newly chosen language.
      setLocale(language)
      await api.auth.updateProfile({ name, avatarColor, locale: language })
      await refresh()
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success(t('Your profile was saved.'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Saving failed.'))
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async () => {
    setPasswordErrors({})
    setSavingPassword(true)
    try {
      await api.auth.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      toast.success(t('Your password was changed.'))
    } catch (error) {
      if (error instanceof ApiError) {
        setPasswordErrors(error.errors)
        if (Object.keys(error.errors).length === 0) toast.error(error.message)
      } else {
        toast.error(t('Changing the password failed.'))
      }
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-slim">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
          {t('Account settings')}
        </h1>

        <Section title={t('Profile')}>
          <div className="mb-5 flex items-center gap-4">
            <span
              className="grid h-14 w-14 place-items-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: avatarColor }}
            >
              {initials(name || user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-900 dark:text-white">{user.email}</p>
              <p className="text-[13px] text-ink-500 dark:text-ink-400">
                {user.role === 'admin' ? t('Instance administrator') : t('User')}
                {user.createdAt && ` · ${t('member since {date}', { date: formatDateTime(user.createdAt) })}`}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Input label={t('Name')} value={name} onChange={(event) => setName(event.target.value)} />

            <Select<Locale>
              label={t('Language')}
              value={language}
              onChange={setLanguage}
              options={LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
              hint={t('Applies to the interface and to messages from the server.')}
            />

            <div>
              <span className="mb-2 block text-sm font-medium text-ink-700 dark:text-ink-200">
                {t('Avatar colour')}
              </span>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    aria-label={t('Colour {value}', { value: color })}
                    className={cx(
                      'h-8 w-8 rounded-full ring-offset-2 transition dark:ring-offset-ink-900',
                      avatarColor === color ? 'ring-2 ring-ink-400' : 'hover:scale-110',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <Button variant="primary" loading={savingProfile} onClick={() => void saveProfile()}>
              {t('Save profile')}
            </Button>
          </div>
        </Section>

        <Section title={t('Appearance')}>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['light', t('Light')],
                ['dark', t('Dark')],
                ['system', t('Follow system')],
              ] as [ThemeMode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={cx(
                  'rounded-lg px-4 py-2 text-sm transition-colors ring-1 ring-inset',
                  mode === value
                    ? 'bg-accent-50 text-accent-700 ring-accent-300 dark:bg-accent-900/30 dark:text-accent-200 dark:ring-accent-700'
                    : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-700',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        {user.role === 'admin' && <RegistrationSection />}
        {user.role === 'admin' && <DatabaseSection />}

        <Section title={t('Change password')}>
          <div className="space-y-4">
            <Input
              label={t('Current password')}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              error={passwordErrors.currentPassword}
            />
            <Input
              label={t('New password')}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              error={passwordErrors.newPassword}
              hint={t('At least 8 characters.')}
            />
            <Button
              variant="primary"
              loading={savingPassword}
              disabled={currentPassword === '' || newPassword === ''}
              onClick={() => void savePassword()}
            >
              {t('Change password')}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  )
}

/**
 * Protecting registration from bots. The code is a simple shared secret –
 * enough for a small instance and it needs no e-mail delivery.
 */
function RegistrationSection() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [open, setOpen] = useState(true)
  const [code, setCode] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string>()

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.admin.settings(),
  })

  useEffect(() => {
    if (!data || loaded) return

    setOpen(data.settings.registrationOpen)
    setCode(data.settings.registrationCode)
    setLoaded(true)
  }, [data, loaded])

  const save = useMutation({
    mutationFn: () => api.admin.updateSettings({ registrationOpen: open, registrationCode: code }),
    onSuccess: async () => {
      setError(undefined)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success(t('Registration settings saved.'))
    },
    onError: (failure: Error) => {
      const fieldError = failure instanceof ApiError ? failure.fieldError('registrationCode') : undefined
      setError(fieldError)
      if (!fieldError) toast.error(failure.message)
    },
  })

  const generate = useMutation({
    mutationFn: () => api.admin.suggestCode(),
    onSuccess: ({ code: suggested }) => {
      setCode(suggested)
      setError(undefined)
    },
  })

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success(t('The code is in your clipboard.'))
    } catch {
      toast.error(t('Copying failed – select the code and copy it manually.'))
    }
  }

  if (isLoading) {
    return (
      <Section title={t('Registration')}>
        <p className="text-sm text-ink-500 dark:text-ink-400">{t('Loading…')}</p>
      </Section>
    )
  }

  const protectedByCode = code.trim() !== ''

  return (
    <Section title={t('Registration')}>
      <p className="mb-4 text-[13px] text-ink-500 dark:text-ink-400">
        {t('Without protection, bots will eventually create accounts on a public domain. Set a registration code and pass it to the people who should be able to register.')}
      </p>

      <label className="mb-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={open}
          onChange={(event) => setOpen(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-ink-300 text-accent-600 focus:ring-accent-500 dark:border-ink-600 dark:bg-ink-800"
        />
        <span>
          <span className="block text-sm font-medium text-ink-800 dark:text-ink-100">
            {t('Allow new accounts to register')}
          </span>
          <span className="block text-[13px] text-ink-500 dark:text-ink-400">
            {t('When off, nobody can register – not even with a valid code.')}
          </span>
        </span>
      </label>

      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label={t('Registration code')}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              error={error}
              placeholder={t('empty = anyone can register')}
              hint={
                protectedByCode
                  ? t('Registration is protected. Share the code only with people who should have access.')
                  : t('Without a code, registration is open to anyone.')
              }
              spellCheck={false}
              autoComplete="off"
              disabled={!open}
            />
          </div>
          <Button
            className="mb-6"
            onClick={() => generate.mutate()}
            loading={generate.isPending}
            disabled={!open}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            {t('Generate')}
          </Button>
          <Button
            className="mb-6"
            onClick={() => void copyCode()}
            disabled={!protectedByCode}
            aria-label={t('Copy code')}
            icon={<Copy className="h-4 w-4" />}
          />
        </div>

        {!protectedByCode && open && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            {t('Registration is currently open to anyone.')}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            {t('Save settings')}
          </Button>
          {data && (
            <span className="text-[13px] text-ink-500 dark:text-ink-400">
              {t('Accounts on this instance: {count}', { count: data.settings.userCount })}
            </span>
          )}
        </div>
      </div>
    </Section>
  )
}

/**
 * Database updates. On FTP-only hosting there is no way to run
 * bin/migrate.php, so pending migrations are applied from here.
 */
function DatabaseSection() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'migrations'],
    queryFn: () => api.admin.migrations(),
  })

  const run = useMutation({
    mutationFn: () => api.admin.runMigrations(),
    onSuccess: async ({ ran }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'migrations'] })
      toast.success(t('Database updated – {count} migrations applied.', { count: ran.length }))
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (isLoading) {
    return (
      <Section title={t('Database')}>
        <p className="text-sm text-ink-500 dark:text-ink-400">{t('Loading…')}</p>
      </Section>
    )
  }

  const pending = data?.pending ?? []

  return (
    <Section title={t('Database')}>
      {pending.length === 0 ? (
        <p className="text-sm text-ink-600 dark:text-ink-300">
          {t('The database schema is up to date.')}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            {t('There are migrations waiting to be applied. Until they run, parts of the app may fail.')}
          </p>
          <ul className="space-y-1 text-[13px] text-ink-600 dark:text-ink-300">
            {pending.map((name) => (
              <li key={name}>
                <code className="rounded bg-ink-100 px-1.5 py-0.5 dark:bg-ink-800">{name}</code>
              </li>
            ))}
          </ul>
          <Button variant="primary" loading={run.isPending} onClick={() => run.mutate()}>
            {t('Apply migrations')}
          </Button>
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-ink-400">
        {t('Applied so far: {count}', { count: (data?.applied ?? []).length })}
      </p>
    </Section>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-400">{title}</h2>
      {children}
    </section>
  )
}
