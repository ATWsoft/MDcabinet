/**
 * Editorové príkazy nad CodeMirror – obalenie výberu, prefixy riadkov,
 * vkladanie odkazov a obrázkov. Všetko cez transakcie, takže undo funguje.
 */

import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

/** Obalí výber značkou (**tučné**, *kurzíva*, `kód`…). Druhé volanie ju odstráni. */
export function wrapSelection(view: EditorView, before: string, after = before): void {
  const { state } = view

  const transaction = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)

    // Už je výber obalený? Potom značku odoberieme (správanie ako toggle).
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

/** Pridá/odoberie prefix na začiatku každého vybraného riadku (#, >, -, 1.). */
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

/** Nastaví úroveň nadpisu na aktuálnom riadku (0 = odstrániť). */
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

/** Vloží text na pozíciu kurzora (odkaz, obrázok, tabuľka…). */
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

/** Odkaz: z výberu spraví text odkazu, kurzor skočí do URL. */
export function insertLink(view: EditorView, url = ''): void {
  const { state } = view
  const range = state.selection.main
  const selected = state.sliceDoc(range.from, range.to) || 'text odkazu'
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

export function insertTable(view: EditorView): void {
  insertAtCursor(
    view,
    '\n| Stĺpec A | Stĺpec B |\n| --- | --- |\n| hodnota | hodnota |\n',
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
