import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, RotateCcw, X } from 'lucide-react'

import { api } from '@/lib/api'
import { formatDateTime, timeAgo } from '@/lib/utils'
import { Button, ConfirmDialog, PageLoader, useToast } from '@/components/ui'
import { MarkdownPreview } from '@/components/MarkdownPreview'

const CHANGE_LABELS: Record<string, string> = {
  create: 'vytvorenie',
  update: 'úprava',
  revert: 'návrat',
}

/**
 * Panel s históriou dokumentu. Kliknutie na revíziu ju ukáže v náhľade,
 * tlačidlom „Obnoviť“ sa dokument vráti do daného stavu (ako nová revízia).
 */
export function RevisionsDrawer({
  open, onClose, documentId,
}: {
  open: boolean
  onClose: () => void
  documentId: number
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [reverting, setReverting] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['revisions', documentId],
    queryFn: () => api.documents.revisions(documentId),
    enabled: open,
  })

  const { data: detail, isFetching: loadingDetail } = useQuery({
    queryKey: ['revision', documentId, selected],
    queryFn: () => api.documents.revision(documentId, selected as number),
    enabled: open && selected !== null,
  })

  const revert = useMutation({
    mutationFn: (revisionId: number) => api.documents.revert(documentId, revisionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['document', documentId] })
      await queryClient.invalidateQueries({ queryKey: ['revisions', documentId] })
      toast.success('Dokument je vrátený na zvolenú revíziu.')
      setReverting(null)
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (!open) return null

  const revisions = data?.revisions ?? []

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink-950/30" onClick={onClose} aria-hidden />

      <aside
        role="dialog"
        aria-label="História dokumentu"
        className="relative flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl dark:bg-ink-900"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-ink-200 px-5 py-3.5 dark:border-ink-800">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white">
            <History className="h-4 w-4 text-ink-400" />
            História dokumentu
          </h2>
          <button
            onClick={onClose}
            aria-label="Zavrieť"
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="w-72 shrink-0 overflow-y-auto scrollbar-slim border-r border-ink-200 dark:border-ink-800">
            {isLoading ? (
              <PageLoader label="Načítavam revízie…" />
            ) : revisions.length === 0 ? (
              <p className="p-5 text-sm text-ink-500 dark:text-ink-400">Zatiaľ žiadne revízie.</p>
            ) : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {revisions.map((revision) => (
                  <li key={revision.id}>
                    <button
                      onClick={() => setSelected(revision.id)}
                      className={
                        'w-full px-4 py-3 text-left transition-colors ' +
                        (selected === revision.id
                          ? 'bg-accent-50 dark:bg-accent-900/30'
                          : 'hover:bg-ink-50 dark:hover:bg-ink-800')
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink-900 dark:text-white">
                          #{revision.revisionNo}
                        </span>
                        <span className="text-[11.5px] text-ink-400">{timeAgo(revision.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[12.5px] text-ink-600 dark:text-ink-300">
                        {revision.summary ?? CHANGE_LABELS[revision.changeType] ?? revision.changeType}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-ink-400">
                        {revision.userName ?? 'neznámy autor'}
                        {revision.contentLength != null && ` · ${revision.contentLength} znakov`}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto scrollbar-slim bg-ink-50/50 p-6 dark:bg-ink-950/30">
            {selected === null ? (
              <p className="mt-10 text-center text-sm text-ink-400">
                Vyber revíziu vľavo a uvidíš, ako dokument vtedy vyzeral.
              </p>
            ) : loadingDetail ? (
              <PageLoader />
            ) : detail ? (
              <div>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-ink-200 dark:bg-ink-800 dark:ring-ink-700">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900 dark:text-white">
                      {detail.revision.title}
                    </p>
                    <p className="text-[12px] text-ink-500 dark:text-ink-400">
                      revízia #{detail.revision.revisionNo} · {formatDateTime(detail.revision.createdAt)}
                    </p>
                  </div>
                  <Button
                    icon={<RotateCcw className="h-4 w-4" />}
                    onClick={() => setReverting(detail.revision.id)}
                  >
                    Obnoviť túto verziu
                  </Button>
                </div>

                <MarkdownPreview content={detail.revision.content ?? ''} />
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={reverting !== null}
        title="Obnoviť staršiu verziu?"
        description="Aktuálny text sa nahradí obsahom vybranej revízie."
        confirmLabel="Obnoviť"
        note="História zostane zachovaná – vznikne nová revízia typu „návrat“, takže sa vieš vrátiť aj späť."
        onCancel={() => setReverting(null)}
        onConfirm={() => reverting !== null && revert.mutate(reverting)}
        loading={revert.isPending}
      />
    </div>
  )
}
