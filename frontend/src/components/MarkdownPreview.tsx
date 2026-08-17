import { useMemo } from 'react'

import { renderMarkdown } from '@/lib/markdown'
import { cx } from '@/lib/utils'
import { useI18n } from '@/state/locale'

/**
 * Rendered Markdown. The HTML goes through DOMPurify inside renderMarkdown(),
 * which is what makes dangerouslySetInnerHTML safe here.
 */
export function MarkdownPreview({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const { t } = useI18n()
  const html = useMemo(() => renderMarkdown(content), [content])

  if (content.trim() === '') {
    return (
      <div className={cx('text-sm italic text-ink-400 dark:text-ink-500', className)}>
        {t('This document is still empty – start typing on the left.')}
      </div>
    )
  }

  return (
    <div
      className={cx('markdown-body', className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
