import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Home, Library, Plus } from 'lucide-react'

import { api } from '@/lib/api'
import type { Cabinet } from '@/lib/types'
import { cx } from '@/lib/utils'
import { Button, Input, Modal, Spinner, useToast } from '@/components/ui'
import { CabinetTree, useTreeState } from '@/components/TreeNav'

/**
 * Ľavý panel: zoznam skríň, pod každou sa lazy načíta jej strom.
 * Načítavame až po rozbalení – inštancia s desiatkami skríň by inak
 * pri každom otvorení appky ťahala celý obsah.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { open, toggle } = useTreeState()
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['cabinets'],
    queryFn: () => api.cabinets.list(),
  })

  const cabinets = data?.cabinets ?? []

  return (
    <div className="flex h-full flex-col">
      <nav className="px-3 py-3">
        <NavLink
          to="/"
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-200'
                : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
            )
          }
        >
          <Home className="h-4 w-4" />
          Prehľad
        </NavLink>
      </nav>

      <div className="flex items-center justify-between px-5 pb-1.5">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
          <Library className="h-3.5 w-3.5" />
          Skrine
        </h2>
        <button
          onClick={() => setCreating(true)}
          title="Nová skriňa"
          aria-label="Nová skriňa"
          className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-slim px-2 pb-6">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : cabinets.length === 0 ? (
          <p className="px-3 py-4 text-[13px] text-ink-400 dark:text-ink-500">
            Zatiaľ nemáš žiadnu skriňu. Vytvor prvú cez <strong>+</strong> vyššie.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {cabinets.map((cabinet) => (
              <CabinetSection
                key={cabinet.id}
                cabinet={cabinet}
                expanded={open.has(`cabinet-${cabinet.id}`)}
                onToggle={() => toggle(`cabinet-${cabinet.id}`)}
                treeOpen={open}
                onTreeToggle={toggle}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </div>

      <NewCabinetModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function CabinetSection({
  cabinet, expanded, onToggle, treeOpen, onTreeToggle, onNavigate,
}: {
  cabinet: Cabinet
  expanded: boolean
  onToggle: () => void
  treeOpen: Set<string>
  onTreeToggle: (key: string) => void
  onNavigate?: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['cabinet', cabinet.id],
    queryFn: () => api.cabinets.show(cabinet.id),
    enabled: expanded,
  })

  return (
    <li>
      <div className="group flex items-center gap-0.5">
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Zbaliť skriňu' : 'Rozbaliť skriňu'}
          className="rounded p-0.5 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
        >
          <ChevronRight className={cx('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
        </button>
        <NavLink
          to={`/cabinets/${cabinet.id}`}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-accent-50 font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-200'
                : 'text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800',
            )
          }
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: cabinet.color }}
            aria-hidden
          />
          <span className="truncate">{cabinet.name}</span>
        </NavLink>
      </div>

      {expanded && (
        <div className="ml-4 mt-0.5 border-l border-ink-100 pl-1.5 dark:border-ink-800">
          {isLoading ? (
            <div className="px-3 py-2">
              <Spinner className="h-4 w-4" />
            </div>
          ) : data ? (
            <CabinetTree cabinet={data.cabinet} open={treeOpen} onToggle={onTreeToggle} />
          ) : null}
        </div>
      )}
    </li>
  )
}

function NewCabinetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: () => api.cabinets.create({ name, color }),
    onSuccess: async ({ cabinet }) => {
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(`Skriňa „${cabinet.name}“ je vytvorená.`)
      setName('')
      onClose()
      navigate(`/cabinets/${cabinet.id}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6']

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nová skriňa"
      description="Skriňa je najvyššia úroveň – zoskupuje šuplíky s dokumentmi."
      footer={
        <>
          <Button onClick={onClose}>Zrušiť</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={name.trim() === ''}
            onClick={() => mutation.mutate()}
          >
            Vytvoriť
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim() !== '') mutation.mutate()
        }}
      >
        <Input
          label="Názov"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="napr. Firemná dokumentácia"
          autoFocus
        />
        <div>
          <span className="mb-2 block text-sm font-medium text-ink-700 dark:text-ink-200">Farba</span>
          <div className="flex flex-wrap gap-2">
            {palette.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setColor(value)}
                aria-label={`Farba ${value}`}
                className={cx(
                  'h-7 w-7 rounded-lg ring-offset-2 transition dark:ring-offset-ink-900',
                  color === value ? 'ring-2 ring-ink-400' : 'hover:scale-110',
                )}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}
