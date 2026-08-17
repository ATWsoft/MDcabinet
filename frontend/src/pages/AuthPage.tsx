import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { ApiError, bootstrap } from '@/lib/api'
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n'
import { useAuth } from '@/state/auth'
import { useI18n } from '@/state/locale'
import { Button, Input, PageLoader, Select } from '@/components/ui'

/**
 * Sign-in and registration on one page – MDcabinet instances tend to be small
 * and switching between two routes would be a needless extra step.
 */
export function AuthPage() {
  const { t, locale, setLocale } = useI18n()
  const { user, instance, loading, login, register } = useAuth()
  const location = useLocation()

  const firstRun = instance ? !instance.hasUsers : false
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <PageLoader label={t('Checking your session…')} />
  if (user) return <Navigate to={location.state?.from ?? '/'} replace />

  // The first user on a fresh instance registers straight away as admin.
  const effectiveMode = firstRun ? 'register' : mode

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    setMessage(null)
    setBusy(true)

    try {
      if (effectiveMode === 'register') {
        await register({ email, name, password, locale, registrationCode })
      } else {
        await login(email, password)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.errors)
        setMessage(Object.keys(error.errors).length === 0 ? error.message : null)
      } else {
        setMessage(t('Could not reach the server.'))
      }
    } finally {
      setBusy(false)
    }
  }

  const subtitle = firstRun
    ? t('Welcome! Create the first account – it automatically gets administrator rights.')
    : effectiveMode === 'login'
      ? t('Sign in to your cabinets of documents.')
      : t('Create an account and start organising your notes.')

  return (
    <div className="flex min-h-full items-center justify-center bg-ink-50 px-4 py-12 dark:bg-ink-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent-600 text-white shadow-lg shadow-accent-600/20">
            <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
              <rect x="4" y="6" width="24" height="8" rx="2" fill="currentColor" opacity="0.55" />
              <rect x="4" y="18" width="24" height="8" rx="2" fill="currentColor" />
            </svg>
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900 dark:text-white">
            {bootstrap.appName}
          </h1>
          <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800"
        >
          {effectiveMode === 'register' && (
            <Input
              label={t('Name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.name}
              autoComplete="name"
              required
            />
          )}

          <Input
            label={t('E-mail')}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            autoComplete="email"
            required
          />

          <Input
            label={t('Password')}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            hint={effectiveMode === 'register' ? t('At least 8 characters.') : undefined}
            autoComplete={effectiveMode === 'register' ? 'new-password' : 'current-password'}
            required
          />

          {effectiveMode === 'register' && (
            <Select<Locale>
              label={t('Language')}
              value={locale}
              onChange={setLocale}
              options={LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
              hint={t('You can change this later in your account settings.')}
            />
          )}

          {effectiveMode === 'register' && instance?.requiresRegistrationCode && (
            <Input
              label={t('Registration code')}
              value={registrationCode}
              onChange={(event) => setRegistrationCode(event.target.value)}
              error={errors.registrationCode}
              hint={t('The administrator of this instance will give you the code.')}
              autoComplete="off"
              spellCheck={false}
              required
            />
          )}

          {message && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {message}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            {effectiveMode === 'register' ? t('Create account') : t('Sign in')}
          </Button>

          {!firstRun && instance?.allowRegistration && (
            <p className="pt-1 text-center text-[13px] text-ink-500 dark:text-ink-400">
              {mode === 'login' ? t('No account yet?') : t('Already have an account?')}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login')
                  setErrors({})
                  setMessage(null)
                }}
                className="font-medium text-accent-600 hover:underline dark:text-accent-300"
              >
                {mode === 'login' ? t('Register') : t('Sign in')}
              </button>
            </p>
          )}
        </form>

        {/* Language is also switchable before signing in, so the form is readable. */}
        {effectiveMode === 'login' && (
          <div className="mt-5 flex justify-center gap-2">
            {LOCALES.map((value) => (
              <button
                key={value}
                onClick={() => setLocale(value)}
                className={
                  'rounded-md px-2.5 py-1 text-[12.5px] transition-colors ' +
                  (value === locale
                    ? 'bg-white font-medium text-accent-700 shadow-sm ring-1 ring-ink-200 dark:bg-ink-800 dark:text-accent-200 dark:ring-ink-700'
                    : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-white')
                }
              >
                {LOCALE_NAMES[value]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
