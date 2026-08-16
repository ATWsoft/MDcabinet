import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { ApiError, bootstrap } from '@/lib/api'
import { useAuth } from '@/state/auth'
import { Button, Input, PageLoader } from '@/components/ui'

/**
 * Prihlásenie aj registrácia na jednej stránke – inštancie MDcabinetu
 * bývajú malé a prepínanie medzi dvoma routami je tu zbytočný krok navyše.
 */
export function AuthPage() {
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

  if (loading) return <PageLoader label="Overujem prihlásenie…" />
  if (user) return <Navigate to={location.state?.from ?? '/'} replace />

  // Prvý používateľ na čerstvej inštancii sa rovno registruje ako správca.
  const effectiveMode = firstRun ? 'register' : mode

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    setMessage(null)
    setBusy(true)

    try {
      if (effectiveMode === 'register') {
        await register(email, name, password, registrationCode)
      } else {
        await login(email, password)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.errors)
        setMessage(Object.keys(error.errors).length === 0 ? error.message : null)
      } else {
        setMessage('Nepodarilo sa spojiť so serverom.')
      }
    } finally {
      setBusy(false)
    }
  }

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
          <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
            {firstRun
              ? 'Vitaj! Vytvor si prvý účet – automaticky dostane práva správcu.'
              : effectiveMode === 'login'
                ? 'Prihlás sa do svojich skríň s dokumentmi.'
                : 'Vytvor si účet a začni si organizovať poznámky.'}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800"
        >
          {effectiveMode === 'register' && (
            <Input
              label="Meno"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.name}
              autoComplete="name"
              required
            />
          )}

          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            autoComplete="email"
            required
          />

          <Input
            label="Heslo"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            hint={effectiveMode === 'register' ? 'Minimálne 8 znakov.' : undefined}
            autoComplete={effectiveMode === 'register' ? 'new-password' : 'current-password'}
            required
          />

          {effectiveMode === 'register' && instance?.requiresRegistrationCode && (
            <Input
              label="Registračný kód"
              value={registrationCode}
              onChange={(event) => setRegistrationCode(event.target.value)}
              error={errors.registrationCode}
              hint="Kód dostaneš od správcu tejto inštancie."
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
            {effectiveMode === 'register' ? 'Vytvoriť účet' : 'Prihlásiť sa'}
          </Button>

          {!firstRun && instance?.allowRegistration && (
            <p className="pt-1 text-center text-[13px] text-ink-500 dark:text-ink-400">
              {mode === 'login' ? 'Ešte nemáš účet?' : 'Už máš účet?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login')
                  setErrors({})
                  setMessage(null)
                }}
                className="font-medium text-accent-600 hover:underline dark:text-accent-300"
              >
                {mode === 'login' ? 'Zaregistruj sa' : 'Prihlás sa'}
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
