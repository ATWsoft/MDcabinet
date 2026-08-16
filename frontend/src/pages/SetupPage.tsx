import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Database, XCircle } from 'lucide-react'

import { ApiError, api } from '@/lib/api'
import { Button, Input, PageLoader, useToast } from '@/components/ui'

/**
 * Webový inštalátor pre hostingy bez SSH. Overí prostredie, otestuje
 * pripojenie k databáze, zapíše config/config.php a spustí migrácie.
 */
export function SetupPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState({
    dbHost: 'localhost',
    dbPort: '3306',
    dbName: '',
    dbUser: '',
    dbPass: '',
    appUrl: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['setup'],
    queryFn: () => api.setup.status(),
  })

  if (isLoading) return <PageLoader label="Kontrolujem prostredie…" />

  if (data?.installed) {
    return (
      <Shell>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <h2 className="text-base font-semibold text-ink-900 dark:text-white">
            MDcabinet je už nainštalovaný
          </h2>
          <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
            Inštalátor je z bezpečnostných dôvodov uzamknutý.
          </p>
          <Button variant="primary" className="mt-5" onClick={() => navigate('/')}>
            Prejsť do aplikácie
          </Button>
        </div>
      </Shell>
    )
  }

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const install = async () => {
    setErrors({})
    setBusy(true)
    try {
      const result = await api.setup.install({
        dbHost: form.dbHost,
        dbPort: Number(form.dbPort) || 3306,
        dbName: form.dbName,
        dbUser: form.dbUser,
        dbPass: form.dbPass,
        appUrl: form.appUrl || undefined,
      })
      toast.success(`Hotovo – spustených ${result.migrations.length} migrácií.`)
      await refetch()
      navigate('/login')
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.errors)
        if (Object.keys(error.errors).length === 0) toast.error(error.message)
      } else {
        toast.error('Inštalácia zlyhala.')
      }
    } finally {
      setBusy(false)
    }
  }

  const blockers = (data?.requirements ?? []).filter(
    (requirement) => !requirement.ok && !requirement.key.includes('gd') && requirement.key !== 'assets',
  )

  return (
    <Shell>
      <section className="mb-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-400">
          Kontrola prostredia
        </h2>
        <ul className="space-y-2">
          {(data?.requirements ?? []).map((requirement) => (
            <li key={requirement.key} className="flex items-start gap-2.5 text-sm">
              {requirement.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              )}
              <span className="min-w-0">
                <span className="text-ink-800 dark:text-ink-100">{requirement.label}</span>
                <span className="ml-2 text-[13px] text-ink-400">{requirement.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-400">
          <Database className="h-4 w-4" />
          Pripojenie k databáze
        </h2>
        <p className="mb-5 text-[13px] text-ink-500 dark:text-ink-400">
          Údaje nájdeš v administrácii hostingu. Databáza musí už existovať – MDcabinet
          si v nej sám vytvorí tabuľky.
        </p>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void install()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input label="Server" value={form.dbHost} onChange={update('dbHost')} error={errors.dbHost} />
            </div>
            <Input label="Port" value={form.dbPort} onChange={update('dbPort')} error={errors.dbPort} />
          </div>

          <Input label="Názov databázy" value={form.dbName} onChange={update('dbName')} error={errors.dbName} required />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Používateľ" value={form.dbUser} onChange={update('dbUser')} error={errors.dbUser} required />
            <Input label="Heslo" type="password" value={form.dbPass} onChange={update('dbPass')} error={errors.dbPass} />
          </div>

          <Input
            label="Adresa aplikácie (voliteľné)"
            value={form.appUrl}
            onChange={update('appUrl')}
            placeholder={data?.suggestedUrl}
            hint="Nechaj prázdne a odvodí sa automaticky. Vyplň, ak beží za reverznou proxy."
          />

          {blockers.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              Niektoré požiadavky nie sú splnené – inštalácia môže zlyhať.
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            Nainštalovať
          </Button>
        </form>
      </section>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-ink-50 px-4 py-12 dark:bg-ink-950">
      <div className="mx-auto max-w-xl">
        <header className="mb-8 text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent-600 text-white shadow-lg shadow-accent-600/20">
            <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
              <rect x="4" y="6" width="24" height="8" rx="2" fill="currentColor" opacity="0.55" />
              <rect x="4" y="18" width="24" height="8" rx="2" fill="currentColor" />
            </svg>
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900 dark:text-white">
            Inštalácia MDcabinetu
          </h1>
          <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
            Pár údajov a môžeš začať písať.
          </p>
        </header>
        {children}
      </div>
    </div>
  )
}
