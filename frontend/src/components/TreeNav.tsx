import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronRight, FileText, Folder as FolderIcon, FolderOpen, Inbox } from 'lucide-react'

import type { Cabinet, DocumentSummary, Folder, Tray } from '@/lib/types'
import { cx } from '@/lib/utils'
import { useI18n } from '@/state/locale'

/**
 * Tree navigation in the left panel: Cabinet → Tray → Folder → Document.
 * The expanded state lives in localStorage so the tree survives a reload.
 */

const OPEN_KEY = 'mdcabinet.tree.open'

function readOpen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function useTreeState() {
  const [open, setOpen] = useState<Set<string>>(readOpen)

  const toggle = (key: string) => {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem(OPEN_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const expand = (key: string) => {
    setOpen((current) => {
      if (current.has(key)) return current
      const next = new Set(current).add(key)
      localStorage.setItem(OPEN_KEY, JSON.stringify([...next]))
      return next
    })
  }

  return { open, toggle, expand }
}

interface TreeProps {
  cabinet: Cabinet
  open: Set<string>
  onToggle: (key: string) => void
}

export function CabinetTree({ cabinet, open, onToggle }: TreeProps) {
  const { t } = useI18n()
  const trays = cabinet.trays ?? []

  if (trays.length === 0) {
    return (
      <p className="px-3 py-2 text-[13px] italic text-ink-400 dark:text-ink-500">
        {t('No trays yet.')}
      </p>
    )
  }

  return (
    <ul className="space-y-0.5">
      {trays.map((tray) => (
        <TrayNode key={tray.id} tray={tray} open={open} onToggle={onToggle} />
      ))}
    </ul>
  )
}

function TrayNode({ tray, open, onToggle }: { tray: Tray; open: Set<string>; onToggle: (key: string) => void }) {
  const { t } = useI18n()
  const key = `tray-${tray.id}`
  const expanded = open.has(key)
  const isEmpty = (tray.folders?.length ?? 0) === 0 && (tray.documents?.length ?? 0) === 0

  return (
    <li>
      <div className="group flex items-center gap-0.5">
        <button
          onClick={() => onToggle(key)}
          aria-label={expanded ? t('Collapse') : t('Expand')}
          aria-expanded={expanded}
          className="rounded p-0.5 text-ink-400 transition-transform hover:text-ink-700 dark:hover:text-ink-200"
        >
          <ChevronRight className={cx('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
        </button>
        <NavLink
          to={`/trays/${tray.id}`}
          className={({ isActive }) =>
            cx(
              'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-[13.5px] transition-colors',
              isActive
                ? 'bg-accent-50 font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-200'
                : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
            )
          }
        >
          <Inbox className="h-4 w-4 shrink-0 text-ink-400" />
          <span className="truncate">{tray.name}</span>
        </NavLink>
      </div>

      {expanded && (
        <div className="ml-4 border-l border-ink-100 pl-1.5 dark:border-ink-800">
          {isEmpty ? (
            <p className="px-2 py-1 text-[12.5px] italic text-ink-400 dark:text-ink-500">{t('empty')}</p>
          ) : (
            <>
              {(tray.folders ?? []).map((folder) => (
                <FolderNode key={folder.id} folder={folder} open={open} onToggle={onToggle} />
              ))}
              {(tray.documents ?? []).map((doc) => (
                <DocumentNode key={doc.id} doc={doc} />
              ))}
            </>
          )}
        </div>
      )}
    </li>
  )
}

function FolderNode({
  folder, open, onToggle,
}: {
  folder: Folder
  open: Set<string>
  onToggle: (key: string) => void
}) {
  const { t } = useI18n()
  const key = `folder-${folder.id}`
  const expanded = open.has(key)
  const children = folder.children ?? []
  const documents = folder.documents ?? []

  return (
    <div>
      <button
        onClick={() => onToggle(key)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[13px] text-ink-600 transition-colors hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
      >
        <ChevronRight className={cx('h-3 w-3 shrink-0 text-ink-400 transition-transform', expanded && 'rotate-90')} />
        {expanded ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        ) : (
          <FolderIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        )}
        <span className="truncate">{folder.name}</span>
        {documents.length > 0 && (
          <span className="ml-auto shrink-0 text-[11px] text-ink-400">{documents.length}</span>
        )}
      </button>

      {expanded && (
        <div className="ml-3 border-l border-ink-100 pl-1.5 dark:border-ink-800">
          {children.map((child) => (
            <FolderNode key={child.id} folder={child} open={open} onToggle={onToggle} />
          ))}
          {documents.map((doc) => (
            <DocumentNode key={doc.id} doc={doc} />
          ))}
          {children.length === 0 && documents.length === 0 && (
            <p className="px-2 py-1 text-[12.5px] italic text-ink-400 dark:text-ink-500">{t('empty')}</p>
          )}
        </div>
      )}
    </div>
  )
}

function DocumentNode({ doc }: { doc: DocumentSummary }) {
  return (
    <NavLink
      to={`/documents/${doc.id}`}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[13px] transition-colors',
          isActive
            ? 'bg-accent-50 font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-200'
            : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
        )
      }
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-ink-400" />
      <span className="truncate">{doc.title}</span>
    </NavLink>
  )
}
