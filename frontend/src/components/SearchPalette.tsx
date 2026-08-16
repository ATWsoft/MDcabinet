import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { CornerDownLeft, FileText, Search } from 'lucide-react'

import { api } from '@/lib/api'
import { cx, timeAgo } from '@/lib/utils'
import { Spinner } from '@/components/ui'

/**
 * Rýchle hľadanie (Ctrl/⌘+K). Beží nad fulltextom v MySQL,
 * výsledky sa vyberajú šípkami a otvárajú Enterom.
 */
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 220)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setDebounced('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.search(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 15_000,
  })

  const results = useMemo(() => data?.results ?? [], [data])

  useEffect(() => setActive(0), [results])

  if (!open) return null

  const openResult = (id: number) => {
    onClose()
    navigate(`/documents/${id}`)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => Math.min(current + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault()
      openResult(results[active].id)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Hľadanie v dokumentoch"
        className="relative w-full max-w-2xl animate-slide-up overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-700"
      >
        <div className="flex items-center gap-3 border-b border-ink-100 px-4 dark:border-ink-800">
          <Search className="h-4 w-4 shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Hľadaj v dokumentoch…"
            className="w-full bg-transparent py-3.5 text-[15px] text-ink-900 outline-none placeholder:text-ink-400 dark:text-white"
          />
          {isFetching && <Spinner className="h-4 w-4" />}
        </div>

        <div className="max-h-[55vh] overflow-y-auto scrollbar-slim p-2">
          {debounced.length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-400">
              Napíš aspoň dva znaky. Hľadá sa v názvoch aj v obsahu dokumentov.
            </p>
          ) : results.length === 0 && !isFetching ? (
            <p className="px-3 py-8 text-center text-sm text-ink-400">
              Pre „{debounced}“ sa nič nenašlo.
            </p>
          ) : (
            <ul>
              {results.map((result, index) => (
                <li key={result.id}>
                  <button
                    onMouseEnter={() => setActive(index)}
                    onClick={() => openResult(result.id)}
                    className={cx(
                      'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      index === active
                        ? 'bg-accent-50 dark:bg-accent-900/30'
                        : 'hover:bg-ink-50 dark:hover:bg-ink-800',
                    )}
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900 dark:text-white">
                        {result.title}
                      </span>
                      {result.highlight && (
                        <span className="mt-0.5 block line-clamp-2 text-[13px] text-ink-500 dark:text-ink-400">
                          <Highlighted text={result.highlight} />
                        </span>
                      )}
                      <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-400">
                        {result.cabinetColor && (
                          <span
                            className="h-2 w-2 rounded-sm"
                            style={{ backgroundColor: result.cabinetColor }}
                            aria-hidden
                          />
                        )}
                        {result.cabinetName}
                        {result.trayName && <> · {result.trayName}</>}
                        <> · {timeAgo(result.updatedAt)}</>
                      </span>
                    </span>
                    {index === active && (
                      <CornerDownLeft className="mt-1 h-3.5 w-3.5 shrink-0 text-ink-400" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 px-4 py-2 text-[11.5px] text-ink-400 dark:border-ink-800">
          <span>↑↓ výber · Enter otvoriť · Esc zavrieť</span>
          {results.length > 0 && <span>{results.length} výsledkov</span>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Backend obalí nájdený výraz do «…», tu z toho spravíme <mark>. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(«[^»]*»)/g)

  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('«') && part.endsWith('»') ? (
          <mark
            key={index}
            className="rounded bg-amber-200/70 px-0.5 text-ink-900 dark:bg-amber-500/30 dark:text-amber-100"
          >
            {part.slice(1, -1)}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}
