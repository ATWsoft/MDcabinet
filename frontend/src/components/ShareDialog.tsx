import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Eye, Link2, Lock, Trash2 } from 'lucide-react'

import { api, publicShareUrl } from '@/lib/api'
import type { CrumbType } from '@/lib/types'
import { formatDateTime, timeAgo } from '@/lib/utils'
import { useI18n } from '@/state/locale'
import { Button, Input, Modal, Spinner, useToast } from '@/components/ui'

/**
 * Public read-only links. A link can optionally be locked with a password and
 * given an expiry date.
 */
export function ShareDialog({
  open, onClose, targetType, targetId, targetName,
}: {
  open: boolean
  onClose: () => void
  targetType: CrumbType
  targetId: number
  targetName: string
}) {
  const { t, tn } = useI18n()
  const [password, setPassword] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const queryClient = useQueryClient()
  const toast = useToast()

  const titles: Record<CrumbType, string> = {
    cabinet: t('Share cabinet'),
    tray: t('Share tray'),
    folder: t('Share folder'),
    document: t('Share document'),
  }

  const key = ['shares', targetType, targetId]

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.shares.list(targetType, targetId),
    enabled: open,
  })

  const create = useMutation({
    mutationFn: () =>
      api.shares.create({
        targetType,
        targetId,
        password: password || undefined,
        expiresAt: expiresAt || undefined,
      }),
    onSuccess: async ({ share }) => {
      await queryClient.invalidateQueries({ queryKey: key })
      setPassword('')
      setExpiresAt('')
      void copy(publicShareUrl(share.token))
      toast.success(t('Link created and copied to the clipboard.'))
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: (token: string) => api.shares.remove(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key })
      toast.info(t('The link was revoked.'))
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('The link is in your clipboard.'))
    } catch {
      toast.error(t('Copying failed – select the link and copy it manually.'))
    }
  }

  const shares = data?.shares ?? []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titles[targetType]}
      description={targetName}
      size="lg"
      footer={<Button onClick={onClose}>{t('Close')}</Button>}
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-ink-50 p-4 dark:bg-ink-800/50">
          <h3 className="mb-3 text-sm font-medium text-ink-800 dark:text-ink-100">
            {t('New public link')}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t('Password (optional)')}
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('no password')}
              hint={t('At least 4 characters if you want to use one.')}
            />
            <Input
              label={t('Valid until (optional)')}
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>
          <Button
            variant="primary"
            icon={<Link2 className="h-4 w-4" />}
            className="mt-3"
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            {t('Create link')}
          </Button>
          <p className="mt-2.5 text-[12.5px] text-ink-500 dark:text-ink-400">
            {t('Anyone with the link can read the content. Nobody can change anything.')}
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-ink-800 dark:text-ink-100">
            {t('Existing links')}
          </h3>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : shares.length === 0 ? (
            <p className="py-4 text-sm text-ink-500 dark:text-ink-400">
              {t('No links yet – the content is private.')}
            </p>
          ) : (
            <ul className="space-y-2">
              {shares.map((share) => (
                <li
                  key={share.token}
                  className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 ring-1 ring-ink-200 dark:bg-ink-800 dark:ring-ink-700"
                >
                  <div className="min-w-0 flex-1">
                    <code className="block truncate text-[12.5px] text-ink-600 dark:text-ink-300">
                      {publicShareUrl(share.token)}
                    </code>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-400">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {tn(share.views, 'opened {count} time', 'opened {count} times')}
                        {share.lastViewedAt && ` · ${timeAgo(share.lastViewedAt)}`}
                      </span>
                      {share.hasPassword && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Lock className="h-3 w-3" />
                          {t('password protected')}
                        </span>
                      )}
                      {share.expiresAt && (
                        <span>{t('valid until {date}', { date: formatDateTime(share.expiresAt) })}</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => void copy(publicShareUrl(share.token))}
                    title={t('Copy link')}
                    aria-label={t('Copy link')}
                    className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-white"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove.mutate(share.token)}
                    title={t('Revoke link')}
                    aria-label={t('Revoke link')}
                    className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
