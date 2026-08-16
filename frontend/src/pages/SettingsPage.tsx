import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, RefreshCw } from 'lucide-react'

import { ApiError, api } from '@/lib/api'
import { formatDateTime, initials } from '@/lib/utils'
import { useAuth } from '@/state/auth'
import { useTheme, type ThemeMode } from '@/state/theme'
import { Button, Input, useToast } from '@/components/ui'

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6']

export function SettingsPage() {
  const { user, refresh } = useAuth()
  const { mode, setMode } = useTheme()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [name, setName] = useState(user?.name ?? '')
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? '#6366f1')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [savingPassword, setSavingPassword] = useState(false)

  if (!user) return null

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      await api.auth.updateProfile({ name, avatarColor })
      await refresh()
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('Profil je uložený.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Uloženie zlyhalo.')
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
      toast.success('Heslo je zmenené.')
    } catch (error) {
      if (error instanceof ApiError) {
        setPasswordErrors(error.errors)
        if (Object.keys(error.errors).length === 0) toast.error(error.message)
      } else {
        toast.error('Zmena hesla zlyhala.')
      }
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-slim">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
          Nastavenia účtu
        </h1>

        <Section title="Profil">
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
                {user.role === 'admin' ? 'Správca inštancie' : 'Používateľ'}
                {user.createdAt && ` · účet od ${formatDateTime(user.createdAt)}`}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Input label="Meno" value={name} onChange={(event) => setName(event.target.value)} />

            <div>
              <span className="mb-2 block text-sm font-medium text-ink-700 dark:text-ink-200">
                Farba avatara
              </span>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    aria-label={`Farba ${color}`}
                    className={
                      'h-8 w-8 rounded-full ring-offset-2 transition dark:ring-offset-ink-900 ' +
                      (avatarColor === color ? 'ring-2 ring-ink-400' : 'hover:scale-110')
                    }
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <Button variant="primary" loading={savingProfile} onClick={() => void saveProfile()}>
              Uložiť profil
            </Button>
          </div>
        </Section>

        <Section title="Vzhľad">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['light', 'Svetlý'],
                ['dark', 'Tmavý'],
                ['system', 'Podľa systému'],
              ] as [ThemeMode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={
                  'rounded-lg px-4 py-2 text-sm transition-colors ring-1 ring-inset ' +
                  (mode === value
                    ? 'bg-accent-50 text-accent-700 ring-accent-300 dark:bg-accent-900/30 dark:text-accent-200 dark:ring-accent-700'
                    : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-700')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        {user.role === 'admin' && <RegistrationSection />}

        <Section title="Zmena hesla">
          <div className="space-y-4">
            <Input
              label="Aktuálne heslo"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              error={passwordErrors.currentPassword}
            />
            <Input
              label="Nové heslo"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              error={passwordErrors.newPassword}
              hint="Minimálne 8 znakov."
            />
            <Button
              variant="primary"
              loading={savingPassword}
              disabled={currentPassword === '' || newPassword === ''}
              onClick={() => void savePassword()}
            >
              Zmeniť heslo
            </Button>
          </div>
        </Section>
      </div>
    </div>
  )
}

/**
 * Ochrana registrácie pred botmi. Kód je jednoduchý spoločný tajný reťazec –
 * na malú inštanciu to stačí a nevyžaduje to posielanie e-mailov.
 */
function RegistrationSection() {
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
      toast.success('Nastavenia registrácie sú uložené.')
    },
    onError: (failure: Error) => {
      setError(failure instanceof ApiError ? failure.fieldError('registrationCode') : undefined)
      if (!(failure instanceof ApiError) || !failure.fieldError('registrationCode')) {
        toast.error(failure.message)
      }
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
      toast.success('Kód je v schránke.')
    } catch {
      toast.error('Kopírovanie zlyhalo – kód si označ a skopíruj ručne.')
    }
  }

  if (isLoading) {
    return (
      <Section title="Registrácia">
        <p className="text-sm text-ink-500 dark:text-ink-400">Načítavam…</p>
      </Section>
    )
  }

  const protectedByCode = code.trim() !== ''

  return (
    <Section title="Registrácia">
      <p className="mb-4 text-[13px] text-ink-500 dark:text-ink-400">
        Bez ochrany si na verejnej doméne účet skôr či neskôr vytvoria aj boti.
        Nastav registračný kód a pošli ho tým, ktorí sa majú zaregistrovať.
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
            Povoliť registráciu nových účtov
          </span>
          <span className="block text-[13px] text-ink-500 dark:text-ink-400">
            Po vypnutí sa nezaregistruje nikto – ani s platným kódom.
          </span>
        </span>
      </label>

      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Registračný kód"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              error={error}
              placeholder="prázdne = ktokoľvek sa môže zaregistrovať"
              hint={
                protectedByCode
                  ? 'Registrácia je chránená. Kód pošli len tým, ktorí majú mať prístup.'
                  : 'Bez kódu je registrácia otvorená pre kohokoľvek.'
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
            Vygenerovať
          </Button>
          <Button
            className="mb-6"
            onClick={() => void copyCode()}
            disabled={!protectedByCode}
            aria-label="Kopírovať kód"
            icon={<Copy className="h-4 w-4" />}
          />
        </div>

        {!protectedByCode && open && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            Registrácia je momentálne otvorená pre kohokoľvek.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Uložiť nastavenia
          </Button>
          {data && (
            <span className="text-[13px] text-ink-500 dark:text-ink-400">
              Účtov na inštancii: {data.settings.userCount}
            </span>
          )}
        </div>
      </div>
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
