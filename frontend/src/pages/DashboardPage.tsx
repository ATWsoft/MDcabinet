import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, FileText, Inbox, Library } from 'lucide-react'

import { api } from '@/lib/api'
import { pluralize, timeAgo } from '@/lib/utils'
import { useAuth } from '@/state/auth'
import { EmptyState, PageLoader } from '@/components/ui'

export function DashboardPage() {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard(),
  })

  if (isLoading) return <PageLoader />

  const cabinets = data?.cabinets ?? []
  const recent = data?.recent ?? []

  return (
    <div className="h-full overflow-y-auto scrollbar-slim">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
            {greeting()}, {user?.name.split(' ')[0]}.
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            {cabinets.length === 0
              ? 'Začni tým, že si vytvoríš prvú skriňu.'
              : `${pluralize(cabinets.length, 'skriňa', 'skrine', 'skríň')} · ${pluralize(countDocuments(cabinets), 'dokument', 'dokumenty', 'dokumentov')}`}
          </p>
        </header>

        <section className="mb-10">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            <Library className="h-4 w-4" />
            Skrine
          </h2>

          {cabinets.length === 0 ? (
            <EmptyState
              icon={<Library className="h-10 w-10" />}
              title="Zatiaľ tu nič nie je"
              description="Skriňa je najvyššia úroveň. V nej sú šuplíky, v šuplíkoch zložky a v zložkách dokumenty."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cabinets.map((cabinet) => (
                <Link
                  key={cabinet.id}
                  to={`/cabinets/${cabinet.id}`}
                  className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink-200 transition hover:shadow-md hover:ring-ink-300 dark:bg-ink-900 dark:ring-ink-800 dark:hover:ring-ink-700"
                >
                  <span
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: cabinet.color }}
                    aria-hidden
                  />
                  <h3 className="mt-1 truncate font-medium text-ink-900 dark:text-white">
                    {cabinet.name}
                  </h3>
                  {cabinet.description && (
                    <p className="mt-1 line-clamp-2 text-[13px] text-ink-500 dark:text-ink-400">
                      {cabinet.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-[12px] text-ink-400">
                    <span className="flex items-center gap-1">
                      <Inbox className="h-3.5 w-3.5" />
                      {cabinet.trayCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {cabinet.documentCount ?? 0}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {recent.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
              <Clock className="h-4 w-4" />
              Naposledy upravené
            </h2>

            <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl bg-white ring-1 ring-ink-200 dark:divide-ink-800 dark:bg-ink-900 dark:ring-ink-800">
              {recent.map((doc) => (
                <li key={doc.id}>
                  <Link
                    to={`/documents/${doc.id}`}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink-50 dark:hover:bg-ink-800"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900 dark:text-white">
                        {doc.title}
                      </span>
                      {doc.excerpt && (
                        <span className="mt-0.5 block truncate text-[13px] text-ink-500 dark:text-ink-400">
                          {doc.excerpt}
                        </span>
                      )}
                    </span>
                    <span className="hidden shrink-0 items-center gap-1.5 text-[12px] text-ink-400 sm:flex">
                      {doc.cabinetColor && (
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ backgroundColor: doc.cabinetColor }}
                          aria-hidden
                        />
                      )}
                      {doc.cabinetName}
                    </span>
                    <span className="shrink-0 text-[12px] text-ink-400">{timeAgo(doc.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 10) return 'Dobré ráno'
  if (hour < 18) return 'Dobrý deň'

  return 'Dobrý večer'
}

function countDocuments(cabinets: { documentCount?: number }[]): number {
  return cabinets.reduce((total, cabinet) => total + (cabinet.documentCount ?? 0), 0)
}
