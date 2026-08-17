import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, FolderTree, Inbox, Pencil, Plus, Share2, Trash2 } from 'lucide-react'

import { api } from '@/lib/api'
import { cx, timeAgo } from '@/lib/utils'
import { useI18n } from '@/state/locale'
import {
  Button, ConfirmDialog, EmptyState, Input, Modal, PageLoader, Textarea, useToast,
} from '@/components/ui'
import { ShareDialog } from '@/components/ShareDialog'

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6']

export function CabinetPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const cabinetId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [creatingTray, setCreatingTray] = useState(false)
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cabinet', cabinetId],
    queryFn: () => api.cabinets.show(cabinetId),
    enabled: Number.isFinite(cabinetId),
  })

  const remove = useMutation({
    mutationFn: () => api.cabinets.remove(cabinetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.info(t('The cabinet was deleted.'))
      navigate('/')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (isLoading) return <PageLoader />
  if (isError || !data) {
    return (
      <div className="p-8">
        <EmptyState
          title={t('Cabinet not found')}
          description={t('It may have been deleted or it belongs to another account.')}
        />
      </div>
    )
  }

  const cabinet = data.cabinet
  const trays = cabinet.trays ?? []

  return (
    <div className="h-full overflow-y-auto scrollbar-slim">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span
                className="h-4 w-4 shrink-0 rounded"
                style={{ backgroundColor: cabinet.color }}
                aria-hidden
              />
              <h1 className="truncate text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
                {cabinet.name}
              </h1>
            </div>
            {cabinet.description && (
              <p className="mt-2 max-w-2xl text-sm text-ink-500 dark:text-ink-400">
                {cabinet.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
              {t('Edit')}
            </Button>
            <Button icon={<Share2 className="h-4 w-4" />} onClick={() => setSharing(true)}>
              {t('Share')}
            </Button>
            <Button
              variant="ghost"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setDeleting(true)}
              aria-label={t('Delete cabinet')}
            />
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreatingTray(true)}
            >
              {t('New tray')}
            </Button>
          </div>
        </header>

        {trays.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-10 w-10" />}
            title={t('This cabinet is empty')}
            description={t('A tray groups folders and documents around one topic.')}
            action={
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreatingTray(true)}>
                {t('Create the first tray')}
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {trays.map((tray) => {
              const documents = countDocuments(tray)

              return (
                <Link
                  key={tray.id}
                  to={`/trays/${tray.id}`}
                  className="group rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink-200 transition hover:shadow-md hover:ring-ink-300 dark:bg-ink-900 dark:ring-ink-800 dark:hover:ring-ink-700"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                      <Inbox className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-ink-900 dark:text-white">{tray.name}</h3>
                      {tray.description && (
                        <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-500 dark:text-ink-400">
                          {tray.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-400">
                        <span className="flex items-center gap-1" title={t('Folders')}>
                          <FolderTree className="h-3.5 w-3.5" />
                          {tray.folders?.length ?? 0}
                        </span>
                        <span className="flex items-center gap-1" title={t('Documents')}>
                          <FileText className="h-3.5 w-3.5" />
                          {documents}
                        </span>
                        <span className="ml-auto">{timeAgo(tray.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <TrayFormModal
        open={creatingTray}
        onClose={() => setCreatingTray(false)}
        cabinetId={cabinetId}
      />

      <CabinetEditModal
        open={editing}
        onClose={() => setEditing(false)}
        cabinet={cabinet}
      />

      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        targetType="cabinet"
        targetId={cabinetId}
        targetName={cabinet.name}
      />

      <ConfirmDialog
        open={deleting}
        title={t('Delete this cabinet?')}
        description={t('“{name}” with all its trays and documents.', { name: cabinet.name })}
        onCancel={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
      />
    </div>
  )
}

function countDocuments(tray: { documents?: unknown[]; folders?: { documents?: unknown[]; children?: unknown[] }[] }): number {
  const direct = tray.documents?.length ?? 0
  const nested = (tray.folders ?? []).reduce(
    (total, folder) => total + countDocuments(folder as never),
    0,
  )

  return direct + nested
}

function TrayFormModal({
  open, onClose, cabinetId,
}: {
  open: boolean
  onClose: () => void
  cabinetId: number
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: () => api.trays.create({ cabinetId, name, description: description || undefined }),
    onSuccess: async ({ tray }) => {
      await queryClient.invalidateQueries({ queryKey: ['cabinet', cabinetId] })
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      toast.success(t('The tray was created.'))
      setName('')
      setDescription('')
      onClose()
      navigate(`/trays/${tray.id}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('New tray')}
      description={t('A tray groups folders and documents around one topic.')}
      footer={
        <>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={name.trim() === ''}
            onClick={() => mutation.mutate()}
          >
            {t('Create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={t('Name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('e.g. Processes and policies')}
          autoFocus
        />
        <Textarea
          label={t('Description (optional)')}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
    </Modal>
  )
}

function CabinetEditModal({
  open, onClose, cabinet,
}: {
  open: boolean
  onClose: () => void
  cabinet: { id: number; name: string; description: string | null; color: string }
}) {
  const { t } = useI18n()
  const [name, setName] = useState(cabinet.name)
  const [description, setDescription] = useState(cabinet.description ?? '')
  const [color, setColor] = useState(cabinet.color)
  const queryClient = useQueryClient()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: () => api.cabinets.update(cabinet.id, { name, description, color }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cabinet', cabinet.id] })
      await queryClient.invalidateQueries({ queryKey: ['cabinets'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(t('Changes saved.'))
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Edit cabinet')}
      footer={
        <>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t('Save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={t('Name')} value={name} onChange={(event) => setName(event.target.value)} />
        <Textarea
          label={t('Description')}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div>
          <span className="mb-2 block text-sm font-medium text-ink-700 dark:text-ink-200">
            {t('Colour')}
          </span>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setColor(value)}
                aria-label={t('Colour {value}', { value })}
                className={cx(
                  'h-7 w-7 rounded-lg ring-offset-2 transition dark:ring-offset-ink-900',
                  color === value ? 'ring-2 ring-ink-400' : 'hover:scale-110',
                )}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
