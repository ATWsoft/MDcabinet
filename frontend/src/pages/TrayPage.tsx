import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight, FileText, FilePlus, FolderPlus, Folder as FolderIcon,
  Pencil, Share2, Trash2,
} from 'lucide-react'

import { api } from '@/lib/api'
import type { Folder } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import {
  Button, ConfirmDialog, EmptyState, Input, Modal, PageLoader, Textarea, useToast,
} from '@/components/ui'
import { ShareDialog } from '@/components/ShareDialog'

export function TrayPage() {
  const { id } = useParams()
  const trayId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [newFolderParent, setNewFolderParent] = useState<number | null | 'closed'>('closed')
  const [newDocumentFolder, setNewDocumentFolder] = useState<number | null | 'closed'>('closed')
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tray', trayId],
    queryFn: () => api.trays.show(trayId),
    enabled: Number.isFinite(trayId),
  })

  const remove = useMutation({
    mutationFn: () => api.trays.remove(trayId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      if (data) await queryClient.invalidateQueries({ queryKey: ['cabinet', data.tray.cabinetId] })
      toast.info('Šuplík bol zmazaný.')
      navigate(data ? `/cabinets/${data.tray.cabinetId}` : '/')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (isLoading) return <PageLoader />
  if (isError || !data) {
    return (
      <div className="p-8">
        <EmptyState title="Šuplík sa nenašiel" description="Možno bol zmazaný alebo patrí inému účtu." />
      </div>
    )
  }

  const tray = data.tray
  const folders = tray.folders ?? []
  const documents = tray.documents ?? []
  const isEmpty = folders.length === 0 && documents.length === 0

  return (
    <div className="h-full overflow-y-auto scrollbar-slim">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <nav className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-500 dark:text-ink-400">
          <Link to={`/cabinets/${tray.cabinetId}`} className="hover:text-ink-800 hover:underline dark:hover:text-white">
            Skriňa
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-ink-700 dark:text-ink-200">{tray.name}</span>
        </nav>

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
              {tray.name}
            </h1>
            {tray.description && (
              <p className="mt-2 max-w-2xl text-sm text-ink-500 dark:text-ink-400">{tray.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
              Upraviť
            </Button>
            <Button icon={<Share2 className="h-4 w-4" />} onClick={() => setSharing(true)}>
              Zdieľať
            </Button>
            <Button
              variant="ghost"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setDeleting(true)}
              aria-label="Zmazať šuplík"
            />
            <Button icon={<FolderPlus className="h-4 w-4" />} onClick={() => setNewFolderParent(null)}>
              Zložka
            </Button>
            <Button
              variant="primary"
              icon={<FilePlus className="h-4 w-4" />}
              onClick={() => setNewDocumentFolder(null)}
            >
              Nový dokument
            </Button>
          </div>
        </header>

        {isEmpty ? (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="Šuplík je prázdny"
            description="Vytvor prvý dokument alebo si obsah najskôr rozčleň do zložiek."
            action={
              <Button
                variant="primary"
                icon={<FilePlus className="h-4 w-4" />}
                onClick={() => setNewDocumentFolder(null)}
              >
                Nový dokument
              </Button>
            }
          />
        ) : (
          <div className="space-y-1">
            {folders.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                depth={0}
                trayId={trayId}
                onAddFolder={setNewFolderParent}
                onAddDocument={setNewDocumentFolder}
              />
            ))}
            {documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} depth={0} />
            ))}
          </div>
        )}
      </div>

      <FolderModal
        open={newFolderParent !== 'closed'}
        onClose={() => setNewFolderParent('closed')}
        trayId={trayId}
        parentId={newFolderParent === 'closed' ? null : newFolderParent}
      />

      <DocumentModal
        open={newDocumentFolder !== 'closed'}
        onClose={() => setNewDocumentFolder('closed')}
        trayId={trayId}
        folderId={newDocumentFolder === 'closed' ? null : newDocumentFolder}
      />

      <TrayEditModal open={editing} onClose={() => setEditing(false)} tray={tray} />

      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        targetType="tray"
        targetId={trayId}
        targetName={tray.name}
      />

      <ConfirmDialog
        open={deleting}
        title="Zmazať šuplík?"
        description={`„${tray.name}“ aj so všetkými zložkami a dokumentmi.`}
        onCancel={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
      />
    </div>
  )
}

/* ------------------------------------------------------------- riadky --- */

function FolderRow({
  folder, depth, trayId, onAddFolder, onAddDocument,
}: {
  folder: Folder
  depth: number
  trayId: number
  onAddFolder: (parentId: number) => void
  onAddDocument: (folderId: number) => void
}) {
  const [open, setOpen] = useState(depth === 0)
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const queryClient = useQueryClient()
  const toast = useToast()

  const remove = useMutation({
    mutationFn: () => api.folders.remove(folder.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tray', trayId] })
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      toast.info('Zložka bola zmazaná.')
      setDeleting(false)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const children = folder.children ?? []
  const documents = folder.documents ?? []

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-ink-100/70 dark:hover:bg-ink-800/70"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <FolderIcon className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{folder.name}</span>
          <span className="shrink-0 text-[12px] text-ink-400">
            {documents.length > 0 && `${documents.length} dok.`}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <IconButton label="Nový dokument v zložke" onClick={() => onAddDocument(folder.id)}>
            <FilePlus className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Podzložka" onClick={() => onAddFolder(folder.id)}>
            <FolderPlus className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Premenovať" onClick={() => setRenaming(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Zmazať zložku" onClick={() => setDeleting(true)} danger>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {open && (
        <div>
          {children.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              depth={depth + 1}
              trayId={trayId}
              onAddFolder={onAddFolder}
              onAddDocument={onAddDocument}
            />
          ))}
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} depth={depth + 1} />
          ))}
          {children.length === 0 && documents.length === 0 && (
            <p
              className="px-2 py-1.5 text-[13px] italic text-ink-400 dark:text-ink-500"
              style={{ paddingLeft: `${(depth + 1) * 20 + 30}px` }}
            >
              zložka je prázdna
            </p>
          )}
        </div>
      )}

      <RenameFolderModal
        open={renaming}
        onClose={() => setRenaming(false)}
        folder={folder}
        trayId={trayId}
      />

      <ConfirmDialog
        open={deleting}
        title="Zmazať zložku?"
        description={`„${folder.name}“ aj s obsahom.`}
        onCancel={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
      />
    </div>
  )
}

function DocumentRow({ doc, depth }: { doc: { id: number; title: string; excerpt: string; updatedAt: string | null }; depth: number }) {
  return (
    <Link
      to={`/documents/${doc.id}`}
      className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-ink-100/70 dark:hover:bg-ink-800/70"
      style={{ paddingLeft: `${depth * 20 + 30}px` }}
    >
      <FileText className="h-4 w-4 shrink-0 text-ink-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink-800 dark:text-ink-100">{doc.title}</span>
        {doc.excerpt && (
          <span className="block truncate text-[12.5px] text-ink-400">{doc.excerpt}</span>
        )}
      </span>
      <span className="shrink-0 text-[12px] text-ink-400">{timeAgo(doc.updatedAt)}</span>
    </Link>
  )
}

function IconButton({
  label, onClick, danger, children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={
        'rounded-md p-1.5 text-ink-400 transition-colors ' +
        (danger
          ? 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30'
          : 'hover:bg-ink-200 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-white')
      }
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------- modály --- */

function FolderModal({
  open, onClose, trayId, parentId,
}: {
  open: boolean
  onClose: () => void
  trayId: number
  parentId: number | null
}) {
  const [name, setName] = useState('')
  const queryClient = useQueryClient()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: () => api.folders.create({ trayId, parentId, name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tray', trayId] })
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      toast.success('Zložka je vytvorená.')
      setName('')
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={parentId ? 'Nová podzložka' : 'Nová zložka'}
      size="sm"
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
      <Input
        label="Názov zložky"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && name.trim() !== '') mutation.mutate()
        }}
        autoFocus
      />
    </Modal>
  )
}

function RenameFolderModal({
  open, onClose, folder, trayId,
}: {
  open: boolean
  onClose: () => void
  folder: Folder
  trayId: number
}) {
  const [name, setName] = useState(folder.name)
  const queryClient = useQueryClient()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: () => api.folders.rename(folder.id, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tray', trayId] })
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      toast.success('Zložka je premenovaná.')
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Premenovať zložku"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Zrušiť</Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Uložiť
          </Button>
        </>
      }
    >
      <Input label="Názov" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
    </Modal>
  )
}

function DocumentModal({
  open, onClose, trayId, folderId,
}: {
  open: boolean
  onClose: () => void
  trayId: number
  folderId: number | null
}) {
  const [title, setTitle] = useState('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: () =>
      api.documents.create({
        trayId,
        folderId,
        title,
        content: `# ${title}\n\n`,
      }),
    onSuccess: async ({ document: created }) => {
      await queryClient.invalidateQueries({ queryKey: ['tray', trayId] })
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setTitle('')
      onClose()
      navigate(`/documents/${created.id}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nový dokument"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Zrušiť</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={title.trim() === ''}
            onClick={() => mutation.mutate()}
          >
            Vytvoriť a otvoriť
          </Button>
        </>
      }
    >
      <Input
        label="Názov dokumentu"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && title.trim() !== '') mutation.mutate()
        }}
        placeholder="napr. Onboarding nového kolegu"
        autoFocus
      />
    </Modal>
  )
}

function TrayEditModal({
  open, onClose, tray,
}: {
  open: boolean
  onClose: () => void
  tray: { id: number; name: string; description: string | null; cabinetId: number }
}) {
  const [name, setName] = useState(tray.name)
  const [description, setDescription] = useState(tray.description ?? '')
  const queryClient = useQueryClient()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: () => api.trays.update(tray.id, { name, description }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tray', tray.id] })
      await queryClient.invalidateQueries({ queryKey: ['cabinet', tray.cabinetId] })
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      toast.success('Zmeny sú uložené.')
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upraviť šuplík"
      footer={
        <>
          <Button onClick={onClose}>Zrušiť</Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Uložiť
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Názov" value={name} onChange={(event) => setName(event.target.value)} />
        <Textarea
          label="Popis"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
    </Modal>
  )
}
