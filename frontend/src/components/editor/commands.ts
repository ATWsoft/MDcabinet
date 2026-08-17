/**
 * Editor commands on top of CodeMirror – wrapping the selection, line
 * prefixes, inserting links and images. Everything goes through transactions,
 * so undo keeps working.
 *
 * Any text that ends up inside the document is passed in by the caller, which
 * has access to the translations.
 */

import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

/** Wraps the selection in a marker (**bold**, *italic*, `code`). Toggles off on a second call. */
export function wrapSelection(view: EditorView, before: string, after = before): void {
  const { state } = view

  const transaction = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)

    // Already wrapped? Then remove the markers (toggle behaviour).
    const outerFrom = range.from - before.length
    const outerTo = range.to + after.length
    const alreadyWrapped =
      outerFrom >= 0 &&
      outerTo <= state.doc.length &&
      state.sliceDoc(outerFrom, range.from) === before &&
      state.sliceDoc(range.to, outerTo) === after

    if (alreadyWrapped) {
      return {
        changes: [
          { from: outerFrom, to: range.from, insert: '' },
          { from: range.to, to: outerTo, insert: '' },
        ],
        range: EditorSelection.range(outerFrom, outerFrom + selected.length),
      }
    }

    return {
      changes: { from: range.from, to: range.to, insert: `${before}${selected}${after}` },
      range: EditorSelection.range(
        range.from + before.length,
        range.from + before.length + selected.length,
      ),
    }
  })

  view.dispatch(state.update(transaction, { scrollIntoView: true, userEvent: 'input.wrap' }))
  view.focus()
}

/** Adds or removes a prefix on every selected line (#, >, -, 1.). */
export function toggleLinePrefix(view: EditorView, prefix: string, ordered = false): void {
  const { state } = view
  const changes: { from: number; to: number; insert: string }[] = []

  for (const range of state.selection.ranges) {
    const firstLine = state.doc.lineAt(range.from).number
    const lastLine = state.doc.lineAt(range.to).number

    let counter = 1
    for (let number = firstLine; number <= lastLine; number++) {
      const line = state.doc.line(number)
      const actual = ordered ? `${counter++}. ` : prefix
      const existing = new RegExp(`^${ordered ? '\\d+\\.\\s' : escapeRegex(prefix)}`)

      if (existing.test(line.text)) {
        const matched = existing.exec(line.text)
        changes.push({ from: line.from, to: line.from + (matched?.[0].length ?? 0), insert: '' })
      } else {
        changes.push({ from: line.from, to: line.from, insert: actual })
      }
    }
  }

  view.dispatch(state.update({ changes, userEvent: 'input.prefix' }))
  view.focus()
}

/** Sets the heading level on the current line (0 = remove it). */
export function setHeading(view: EditorView, level: number): void {
  const { state } = view
  const changes: { from: number; to: number; insert: string }[] = []

  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.from)
    const existing = /^(#{1,6})\s+/.exec(line.text)
    const prefix = level === 0 ? '' : `${'#'.repeat(level)} `

    changes.push({
      from: line.from,
      to: line.from + (existing?.[0].length ?? 0),
      insert: prefix,
    })
  }

  view.dispatch(state.update({ changes, userEvent: 'input.heading' }))
  view.focus()
}

/** Inserts text at the cursor (link, image, table…). */
export function insertAtCursor(view: EditorView, text: string, selectOffset?: [number, number]): void {
  const { state } = view
  const range = state.selection.main

  view.dispatch(
    state.update({
      changes: { from: range.from, to: range.to, insert: text },
      selection: selectOffset
        ? { anchor: range.from + selectOffset[0], head: range.from + selectOffset[1] }
        : { anchor: range.from + text.length },
      scrollIntoView: true,
      userEvent: 'input.insert',
    }),
  )
  view.focus()
}

/**
 * Link: the selection becomes the link text and the cursor jumps into the URL.
 * `placeholder` is used when nothing is selected.
 */
export function insertLink(view: EditorView, placeholder: string, url = ''): void {
  const { state } = view
  const range = state.selection.main
  const selected = state.sliceDoc(range.from, range.to) || placeholder
  const markdown = `[${selected}](${url})`

  view.dispatch(
    state.update({
      changes: { from: range.from, to: range.to, insert: markdown },
      selection: url
        ? { anchor: range.from + markdown.length }
        : {
            anchor: range.from + selected.length + 3,
            head: range.from + selected.length + 3,
          },
      scrollIntoView: true,
      userEvent: 'input.link',
    }),
  )
  view.focus()
}

export function insertImage(view: EditorView, url: string, alt = ''): void {
  insertAtCursor(view, `\n![${alt}](${url})\n`)
}

/** @param labels [first column, second column, sample value] */
export function insertTable(view: EditorView, labels: [string, string, string]): void {
  const [columnA, columnB, value] = labels

  insertAtCursor(
    view,
    `\n| ${columnA} | ${columnB} |\n| --- | --- |\n| ${value} | ${value} |\n`,
  )
}

export function insertCodeBlock(view: EditorView): void {
  const { state } = view
  const range = state.selection.main
  const selected = state.sliceDoc(range.from, range.to)

  insertAtCursor(view, `\n\`\`\`\n${selected}\n\`\`\`\n`, [4, 4])
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
