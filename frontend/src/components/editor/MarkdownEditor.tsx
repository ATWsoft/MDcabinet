import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView, keymap } from '@codemirror/view'
import { githubDark, githubLight } from '@uiw/codemirror-theme-github'
import {
  Bold, Code, Columns2, Eye, Heading1, Heading2, Heading3, Image as ImageIcon,
  Italic, Link2, List, ListOrdered, Loader2, Maximize2, Minimize2, PenLine, Quote, Table,
} from 'lucide-react'

import { api } from '@/lib/api'
import { countWords } from '@/lib/markdown'
import { cx, modKey, pluralize } from '@/lib/utils'
import { useTheme } from '@/state/theme'
import { useToast } from '@/components/ui'
import { MarkdownPreview } from '@/components/MarkdownPreview'
import {
  insertCodeBlock, insertImage, insertLink, insertTable,
  setHeading, toggleLinePrefix, wrapSelection,
} from './commands'

export type ViewMode = 'write' | 'split' | 'preview'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  documentId?: number
  saving?: boolean
  dirty?: boolean
  /** Doplnkový obsah do pravej časti lišty (napr. stav uloženia). */
  status?: ReactNode
}

export function MarkdownEditor({
  value, onChange, onSave, documentId, saving = false, dirty = false, status,
}: MarkdownEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const syncingFrom = useRef<'editor' | 'preview' | null>(null)

  const { resolved } = useTheme()
  const toast = useToast()

  const [mode, setMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem('mdcabinet.viewMode')
    return stored === 'write' || stored === 'split' || stored === 'preview' ? stored : 'split'
  })
  const [zen, setZen] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => localStorage.setItem('mdcabinet.viewMode', mode), [mode])

  // Na úzkych displejoch nemá zmysel držať dva stĺpce vedľa seba.
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const apply = () => {
      if (media.matches) setMode((current) => (current === 'split' ? 'write' : current))
    }
    apply()
    media.addEventListener('change', apply)

    return () => media.removeEventListener('change', apply)
  }, [])

  const withView = useCallback((action: (view: EditorView) => void) => {
    const view = editorRef.current?.view
    if (view) action(view)
  }, [])

  /* ------------------------------------------------------------ uploady --- */

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      if (list.length === 0) return

      setUploading(true)
      try {
        for (const file of list) {
          const { file: uploaded } = await api.files.upload(file, documentId)
          withView((view) =>
            uploaded.isImage
              ? insertImage(view, uploaded.url, uploaded.originalName)
              : insertLink(view, uploaded.url),
          )
        }
        toast.success(list.length === 1 ? 'Súbor nahratý.' : `Nahraných ${list.length} súborov.`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Nahrávanie zlyhalo.')
      } finally {
        setUploading(false)
      }
    },
    [documentId, toast, withView],
  )

  const pickFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*,.pdf,.md,.txt,.zip'
    input.onchange = () => input.files && void uploadFiles(input.files)
    input.click()
  }, [uploadFiles])

  /* --------------------------------------------------- klávesové skratky --- */

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: 'true', 'data-gramm': 'false' }),
      keymap.of([
        { key: 'Mod-s', preventDefault: true, run: () => (onSave(), true) },
        { key: 'Mod-b', preventDefault: true, run: (view) => (wrapSelection(view, '**'), true) },
        { key: 'Mod-i', preventDefault: true, run: (view) => (wrapSelection(view, '*'), true) },
        { key: 'Mod-k', preventDefault: true, run: (view) => (insertLink(view), true) },
        { key: 'Mod-e', preventDefault: true, run: (view) => (wrapSelection(view, '`'), true) },
      ]),
      EditorView.domEventHandlers({
        paste(event) {
          const files = Array.from(event.clipboardData?.files ?? [])
          if (files.length === 0) return false
          event.preventDefault()
          void uploadFiles(files)
          return true
        },
        drop(event) {
          const files = Array.from(event.dataTransfer?.files ?? [])
          if (files.length === 0) return false
          event.preventDefault()
          void uploadFiles(files)
          return true
        },
      }),
    ],
    [onSave, uploadFiles],
  )

  /* ------------------------------------------------------ synchro scroll --- */

  const onEditorScroll = useCallback(() => {
    if (mode !== 'split' || syncingFrom.current === 'preview') return

    const scroller = editorRef.current?.view?.scrollDOM
    const preview = previewRef.current
    if (!scroller || !preview) return

    const ratio = scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight)
    syncingFrom.current = 'editor'
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight)
    requestAnimationFrame(() => (syncingFrom.current = null))
  }, [mode])

  useEffect(() => {
    const scroller = editorRef.current?.view?.scrollDOM
    if (!scroller) return

    scroller.addEventListener('scroll', onEditorScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onEditorScroll)
  }, [onEditorScroll, mode])

  const words = useMemo(() => countWords(value), [value])

  /* -------------------------------------------------------------- render --- */

  const showEditor = mode !== 'preview'
  const showPreview = mode !== 'write'

  return (
    <div
      className={cx(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-ink-900',
        zen && 'fixed inset-0 z-40',
      )}
    >
      <Toolbar
        mode={mode}
        onMode={setMode}
        zen={zen}
        onZen={() => setZen((current) => !current)}
        uploading={uploading}
        onUpload={pickFile}
        onCommand={withView}
      />

      <div className="flex min-h-0 flex-1 divide-x divide-ink-100 dark:divide-ink-800">
        {showEditor && (
          <div className={cx('min-w-0 overflow-hidden', showPreview ? 'w-1/2' : 'w-full')}>
            <CodeMirror
              ref={editorRef}
              value={value}
              onChange={onChange}
              extensions={extensions}
              theme={resolved === 'dark' ? githubDark : githubLight}
              height="100%"
              className="h-full"
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: true,
                highlightActiveLineGutter: false,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: false,
                highlightSelectionMatches: false,
                searchKeymap: true,
              }}
              placeholder="Píš v Markdowne… Obrázok vlož pretiahnutím alebo Ctrl+V."
            />
          </div>
        )}

        {showPreview && (
          <div
            ref={previewRef}
            className={cx(
              'min-w-0 overflow-y-auto scrollbar-slim bg-ink-50/40 px-6 py-5 dark:bg-ink-950/30',
              showEditor ? 'w-1/2' : 'w-full',
            )}
          >
            <div className="mx-auto max-w-3xl">
              <MarkdownPreview content={value} />
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-ink-100 bg-ink-50/60 px-4 py-1.5 text-[12px] text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
        <div className="flex items-center gap-3">
          <span>{pluralize(words, 'slovo', 'slová', 'slov')}</span>
          <span className="hidden sm:inline">
            {pluralize(value.length, 'znak', 'znaky', 'znakov')}
          </span>
          <span className="hidden md:inline text-ink-400 dark:text-ink-500">
            {modKey}+S uložiť · {modKey}+B tučné · {modKey}+K odkaz
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {status ?? (dirty ? 'Neuložené zmeny' : 'Uložené')}
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- Toolbar --- */

function Toolbar({
  mode, onMode, zen, onZen, uploading, onUpload, onCommand,
}: {
  mode: ViewMode
  onMode: (mode: ViewMode) => void
  zen: boolean
  onZen: () => void
  uploading: boolean
  onUpload: () => void
  onCommand: (action: (view: EditorView) => void) => void
}) {
  const tools = [
    { icon: Heading1, label: 'Nadpis 1', run: (v: EditorView) => setHeading(v, 1) },
    { icon: Heading2, label: 'Nadpis 2', run: (v: EditorView) => setHeading(v, 2) },
    { icon: Heading3, label: 'Nadpis 3', run: (v: EditorView) => setHeading(v, 3) },
    { divider: true },
    { icon: Bold, label: `Tučné (${modKey}+B)`, run: (v: EditorView) => wrapSelection(v, '**') },
    { icon: Italic, label: `Kurzíva (${modKey}+I)`, run: (v: EditorView) => wrapSelection(v, '*') },
    { icon: Code, label: `Kód (${modKey}+E)`, run: (v: EditorView) => wrapSelection(v, '`') },
    { divider: true },
    { icon: List, label: 'Odrážky', run: (v: EditorView) => toggleLinePrefix(v, '- ') },
    { icon: ListOrdered, label: 'Číslovaný zoznam', run: (v: EditorView) => toggleLinePrefix(v, '', true) },
    { icon: Quote, label: 'Citácia', run: (v: EditorView) => toggleLinePrefix(v, '> ') },
    { divider: true },
    { icon: Link2, label: `Odkaz (${modKey}+K)`, run: (v: EditorView) => insertLink(v) },
    { icon: Table, label: 'Tabuľka', run: (v: EditorView) => insertTable(v) },
    { icon: Code, label: 'Blok kódu', run: (v: EditorView) => insertCodeBlock(v), key: 'codeblock' },
  ] as const

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-ink-100 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900">
      {tools.map((tool, index) =>
        'divider' in tool ? (
          <span key={`d${index}`} className="mx-1 h-5 w-px bg-ink-200 dark:bg-ink-700" />
        ) : (
          <ToolButton
            key={('key' in tool ? tool.key : '') + tool.label}
            label={tool.label}
            icon={<tool.icon className="h-4 w-4" />}
            onClick={() => onCommand(tool.run)}
          />
        ),
      )}

      <span className="mx-1 h-5 w-px bg-ink-200 dark:bg-ink-700" />
      <ToolButton
        label="Nahrať obrázok alebo prílohu"
        icon={uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        onClick={onUpload}
      />

      <div className="ml-auto flex items-center gap-1">
        <div className="flex rounded-lg bg-ink-100 p-0.5 dark:bg-ink-800">
          {([
            ['write', PenLine, 'Len editor'],
            ['split', Columns2, 'Editor + náhľad'],
            ['preview', Eye, 'Len náhľad'],
          ] as const).map(([value, Icon, label]) => (
            <button
              key={value}
              title={label}
              aria-label={label}
              aria-pressed={mode === value}
              onClick={() => onMode(value)}
              className={cx(
                'rounded-md px-2 py-1 transition-colors',
                mode === value
                  ? 'bg-white text-accent-600 shadow-sm dark:bg-ink-700 dark:text-accent-300'
                  : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <ToolButton
          label={zen? 'Ukončiť režim na celú obrazovku' : 'Na celú obrazovku'}
          icon={zen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          onClick={onZen}
        />
      </div>
    </div>
  )
}

function ToolButton({
  label, icon, onClick,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white"
    >
      {icon}
    </button>
  )
}
