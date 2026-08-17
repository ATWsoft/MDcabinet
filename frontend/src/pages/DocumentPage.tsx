import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, History, Pin, Share2, Trash2 } from 'lucide-react'

import { api } from '@/lib/api'
import type { Breadcrumb } from '@/lib/types'
import { cx, timeAgo } from '@/lib/utils'
import { useI18n } from '@/state/locale'
import { Button, ConfirmDialog, EmptyState, PageLoader, useToast } from '@/components/ui'
import { MarkdownEditor } from '@/components/editor/MarkdownEditor'
import { RevisionsDrawer } from '@/components/RevisionsDrawer'
import { ShareDialog } from '@/components/ShareDialog'

const AUTOSAVE_DELAY = 2000

export function DocumentPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const documentId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadedId = useRef<number | null>(null)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => api.documents.show(documentId),
    enabled: Number.isFinite(documentId),
  })

  // The loaded document is copied into local state exactly once – otherwise a
  // refetch would overwrite text the user is still typing.
  useEffect(() => {
    if (!data || loadedId.current === data.document.id) return

    loadedId.current = data.document.id
    setTitle(data.document.title)
    setContent(data.document.content)
    setSavedAt(data.document.updatedAt)
    setDirty(false)
  }, [data])

  const save = useMutation({
    mutationFn: (payload: { title: string; content: string }) =>
      api.documents.update(documentId, payload),
    onSuccess: async ({ document: updated }) => {
      setSavedAt(updated.updatedAt)
      setDirty(false)
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.setQueryData(['document', documentId], (current: typeof data) =>
        current ? { ...current, document: { ...current.document, ...updated } } : current,
      )
    },
    onError: (error: Error) => toast.error(t('Saving failed: {error}', { error: error.message })),
  })

  const saveNow = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    if (!dirty || save.isPending) return

    save.mutate({ title, content })
  }, [content, dirty, save, title])

  // Autosave – two seconds after typing stops.
  useEffect(() => {
    if (!dirty) return

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => save.mutate({ title, content }), AUTOSAVE_DELAY)

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
    // `save` is intentionally left out: the mutation object changes identity
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title, dirty])

  // Safety net against closing the tab with unsaved text.
  useEffect(() => {
    if (!dirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const remove = useMutation({
    mutationFn: () => api.documents.remove(documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.info(t('The document was deleted.'))
      navigate(data ? `/trays/${data.document.trayId}` : '/')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const togglePin = useMutation({
    mutationFn: () => api.documents.update(documentId, { isPinned: !data?.document.isPinned }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['document', documentId] })
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
    },
  })

  if (isLoading) return <PageLoader />
  if (isError || !data) {
    return (
      <div className="p-8">
        <EmptyState
          title={t('Document not found')}
          description={t('It may have been deleted or it belongs to another account.')}
        />
      </div>
    )
  }

  const pinLabel = data.document.isPinned ? t('Unpin') : t('Pin document')

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-ink-200 bg-white px-4 py-3 dark:border-ink-800 dark:bg-ink-900">
        <Breadcrumbs items={data.breadcrumbs} />

        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setDirty(true)
            }}
            onBlur={saveNow}
            aria-label={t('Document title')}
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight text-ink-900 outline-none placeholder:text-ink-300 dark:text-white"
            placeholder={t('Untitled')}
          />

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => togglePin.mutate()}
              aria-label={pinLabel}
              title={pinLabel}
              icon={
                <Pin
                  className={cx('h-4 w-4', data.document.isPinned && 'fill-current text-accent-600')}
                />
              }
            />
            <Button
              size="sm"
              icon={<History className="h-4 w-4" />}
              onClick={() => setHistoryOpen(true)}
            >
              {t('History')}
            </Button>
            <Button size="sm" icon={<Share2 className="h-4 w-4" />} onClick={() => setSharing(true)}>
              {t('Share')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setDeleting(true)}
              aria-label={t('Delete document')}
            />
            <Button
              size="sm"
              variant="primary"
              onClick={saveNow}
              disabled={!dirty}
              loading={save.isPending}
              icon={!save.isPending && !dirty ? <Check className="h-4 w-4" /> : undefined}
            >
              {dirty ? t('Save') : t('Saved')}
            </Button>
          </div>
        </div>
      </div>

      <MarkdownEditor
        value={content}
        onChange={(next) => {
          setContent(next)
          setDirty(true)
        }}
        onSave={saveNow}
        documentId={documentId}
        saving={save.isPending}
        dirty={dirty}
        status={
          save.isPending
            ? t('Saving…')
            : dirty
              ? t('Unsaved changes')
              : savedAt
                ? t('Saved {when}', { when: timeAgo(savedAt) })
                : t('Saved')
        }
      />

      <RevisionsDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        documentId={documentId}
      />

      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        targetType="document"
        targetId={documentId}
        targetName={title}
      />

      <ConfirmDialog
        open={deleting}
        title={t('Delete this document?')}
        description={t('“{name}” will disappear from the tray.', { name: title })}
        onCancel={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
      />
    </div>
  )
}

function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  const path = items.slice(0, -1)

  return (
    <nav className="flex flex-wrap items-center gap-1 text-[12.5px] text-ink-500 dark:text-ink-400">
      {path.map((crumb, index) => (
        <span key={`${crumb.type}-${crumb.id}`} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3 w-3 text-ink-300" />}
          {crumb.type === 'cabinet' ? (
            <Link to={`/cabinets/${crumb.id}`} className="hover:text-ink-800 hover:underline dark:hover:text-white">
              {crumb.name}
            </Link>
          ) : crumb.type === 'tray' ? (
            <Link to={`/trays/${crumb.id}`} className="hover:text-ink-800 hover:underline dark:hover:text-white">
              {crumb.name}
            </Link>
          ) : (
            <span>{crumb.name}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
