import { useMemo } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import { cx } from '@/lib/utils'

/**
 * Vyrenderovaný Markdown. HTML ide cez DOMPurify v renderMarkdown(),
 * takže dangerouslySetInnerHTML je tu bezpečné.
 */
export function MarkdownPreview({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const html = useMemo(() => renderMarkdown(content), [content])

  if (content.trim() === '') {
    return (
      <div className={cx('text-sm italic text-ink-400 dark:text-ink-500', className)}>
        Dokument je zatiaľ prázdny – začni písať vľavo.
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
