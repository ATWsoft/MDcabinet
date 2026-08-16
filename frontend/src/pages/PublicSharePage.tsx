import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, FileText, Folder as FolderIcon, Lock } from 'lucide-react'

import { ApiError, api, bootstrap } from '@/lib/api'
import type { Doc, DocumentSummary, Folder, PublicShare, Tray } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { Button, EmptyState, Input, PageLoader } from '@/components/ui'
import { MarkdownPreview } from '@/components/MarkdownPreview'

/**
 * Verejné zobrazenie zdieľaného obsahu. Beží bez prihlásenia,
 * je len na čítanie a vôbec nepoužíva ľavý panel appky.
 */
export function PublicSharePage() {
  const { token = '' } = useParams()
  const [share, setShare] = useState<PublicShare | null>(null)
  const [password, setPassword] = useState('')
  const [unlockError, setUnlockError] = useState<string>()
  const [unlocking, setUnlocking] = useState(false)
  const [openDocument, setOpenDocument] = useState<number | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public', token],
    queryFn: () => api.public.show(token),
    retry: false,
  })

  const payload = share ?? data ?? null

  const unlock = async () => {
    setUnlockError(undefined)
    setUnlocking(true)
    try {
      setShare(await api.public.unlock(token, password))
    } catch (unlockFailure) {
      setUnlockError(
        unlockFailure instanceof ApiError
          ? (unlockFailure.fieldError('password') ?? unlockFailure.message)
          : 'Odomknutie zlyhalo.',
      )
    } finally {
      setUnlocking(false)
    }
  }

  if (isLoading) return <PageLoader />

  if (isError) {
    return (
      <PublicShell>
        <EmptyState
          title="Odkaz nie je dostupný"
          description={error instanceof Error ? error.message : 'Odkaz neexistuje alebo mu vypršala platnosť.'}
        />
      </PublicShell>
    )
  }

  if (!payload) return null

  if (payload.needsPassword) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
              <Lock className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Obsah je zamknutý</h2>
              <p className="text-[13px] text-ink-500 dark:text-ink-400">Zadaj heslo, ktoré ti poslali.</p>
            </div>
          </div>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              void unlock()
            }}
          >
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={unlockError}
              autoFocus
            />
            <Button type="submit" variant="primary" className="w-full" loading={unlocking}>
              Odomknúť
            </Button>
          </form>
        </div>
      </PublicShell>
    )
  }

  // Zdieľaný jeden dokument – zobrazíme ho rovno.
  if (payload.document) {
    return (
      <PublicShell sharedAt={payload.sharedAt}>
        <DocumentView doc={payload.document} />
      </PublicShell>
    )
  }

  // Zdieľaný celok – vľavo obsah, vpravo zvolený dokument.
  const tree = payload.cabinet ?? payload.tray ?? payload.folder

  return (
    <PublicShell sharedAt={payload.sharedAt} wide>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <nav className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
          <h2 className="mb-3 truncate text-sm font-semibold text-ink-900 dark:text-white">
            {tree && 'name' in tree ? tree.name : 'Obsah'}
          </h2>
          <PublicTree payload={payload} onSelect={setOpenDocument} selected={openDocument} />
        </nav>

        <div className="min-w-0">
          {openDocument === null ? (
            <EmptyState
              icon={<FileText className="h-9 w-9" />}
              title="Vyber dokument"
              description="Vľavo je obsah zdieľanej sekcie."
            />
          ) : (
            <PublicDocument token={token} documentId={openDocument} />
          )}
        </div>
      </div>
    </PublicShell>
  )
}

function PublicShell({
  children, sharedAt, wide,
}: {
  children: React.ReactNode
  sharedAt?: string
  wide?: boolean
}) {
  return (
    <div className="min-h-full bg-ink-50 dark:bg-ink-950">
      <header className="border-b border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
        <div className={`mx-auto flex items-center gap-2.5 px-5 py-3 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-600 text-white">
            <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden>
              <rect x="4" y="6" width="24" height="8" rx="2" fill="currentColor" opacity="0.55" />
              <rect x="4" y="18" width="24" height="8" rx="2" fill="currentColor" />
            </svg>
          </span>
          <span className="text-sm font-semibold text-ink-900 dark:text-white">{bootstrap.appName}</span>
          <span className="ml-auto rounded-full bg-ink-100 px-2.5 py-1 text-[11.5px] text-ink-500 dark:bg-ink-800 dark:text-ink-400">
            zdieľané · len na čítanie
            {sharedAt && ` · ${formatDateTime(sharedAt)}`}
          </span>
        </div>
      </header>

      <main className={`mx-auto px-5 py-8 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{children}</main>
    </div>
  )
}

function DocumentView({ doc }: { doc: Doc }) {
  return (
    <article className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-ink-200 sm:p-9 dark:bg-ink-900 dark:ring-ink-800">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-ink-900 dark:text-white">
        {doc.title}
      </h1>
      <MarkdownPreview content={doc.content} />
    </article>
  )
}

function PublicDocument({ token, documentId }: { token: string; documentId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', token, 'document', documentId],
    queryFn: () => api.public.document(token, documentId),
    retry: false,
  })

  if (isLoading) return <PageLoader />
  if (isError || !data) {
    return <EmptyState title="Dokument sa nepodarilo načítať" />
  }

  return <DocumentView doc={data.document} />
}

function PublicTree({
  payload, onSelect, selected,
}: {
  payload: PublicShare
  onSelect: (id: number) => void
  selected: number | null
}) {
  const trays: Tray[] = payload.cabinet?.trays ?? (payload.tray ? [payload.tray] : [])
  const rootFolder = payload.folder

  if (rootFolder) {
    return (
      <FolderBranch folder={rootFolder} onSelect={onSelect} selected={selected} depth={0} />
    )
  }

  if (trays.length === 0) {
    return <p className="text-[13px] text-ink-400">Zdieľaná sekcia je prázdna.</p>
  }

  return (
    <div className="space-y-3">
      {trays.map((tray) => (
        <div key={tray.id}>
          {payload.cabinet && (
            <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-ink-400">
              <ChevronRight className="h-3 w-3" />
              {tray.name}
            </p>
          )}
          {(tray.folders ?? []).map((folder) => (
            <FolderBranch
              key={folder.id}
              folder={folder}
              onSelect={onSelect}
              selected={selected}
              depth={0}
            />
          ))}
          {(tray.documents ?? []).map((doc) => (
            <DocumentLink key={doc.id} doc={doc} onSelect={onSelect} selected={selected} depth={0} />
          ))}
        </div>
      ))}
    </div>
  )
}

function FolderBranch({
  folder, onSelect, selected, depth,
}: {
  folder: Folder
  onSelect: (id: number) => void
  selected: number | null
  depth: number
}) {
  return (
    <div>
      <p
        className="flex items-center gap-1.5 py-1 text-[13px] font-medium text-ink-700 dark:text-ink-200"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <FolderIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="truncate">{folder.name}</span>
      </p>
      {(folder.children ?? []).map((child) => (
        <FolderBranch
          key={child.id}
          folder={child}
          onSelect={onSelect}
          selected={selected}
          depth={depth + 1}
        />
      ))}
      {(folder.documents ?? []).map((doc) => (
        <DocumentLink key={doc.id} doc={doc} onSelect={onSelect} selected={selected} depth={depth + 1} />
      ))}
    </div>
  )
}

function DocumentLink({
  doc, onSelect, selected, depth,
}: {
  doc: DocumentSummary
  onSelect: (id: number) => void
  selected: number | null
  depth: number
}) {
  return (
    <button
      onClick={() => onSelect(doc.id)}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      className={
        'flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[13px] transition-colors ' +
        (selected === doc.id
          ? 'bg-accent-50 font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-200'
          : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800')
      }
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-ink-400" />
      <span className="truncate">{doc.title}</span>
    </button>
  )
}
