/**
 * Markdown to safe HTML.
 *
 * markdown-it renders, DOMPurify sanitizes. The order matters: Markdown may
 * contain raw HTML, so without sanitizing, a shared document would be an
 * open door for XSS.
 */

import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import taskLists from 'markdown-it-task-lists'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'

// Only the languages that actually show up in documentation are
// registered: the full highlight.js bundle weighs over 900 kB.
import bash from 'highlight.js/lib/languages/bash'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdownLang from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import python from 'highlight.js/lib/languages/python'
import shell from 'highlight.js/lib/languages/shell'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

for (const [name, language] of [
  ['bash', bash], ['csharp', csharp], ['css', css], ['diff', diff], ['go', go],
  ['ini', ini], ['java', java], ['javascript', javascript], ['json', json],
  ['markdown', markdownLang], ['php', php], ['python', python], ['shell', shell],
  ['sql', sql], ['typescript', typescript], ['xml', xml], ['yaml', yaml],
] as const) {
  hljs.registerLanguage(name, language)
}

hljs.registerAliases(['js', 'jsx'], { languageName: 'javascript' })
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' })
hljs.registerAliases(['html', 'svg'], { languageName: 'xml' })
hljs.registerAliases(['yml'], { languageName: 'yaml' })
hljs.registerAliases(['sh', 'zsh'], { languageName: 'bash' })
hljs.registerAliases(['py'], { languageName: 'python' })
hljs.registerAliases(['cs', 'c#'], { languageName: 'csharp' })
hljs.registerAliases(['md'], { languageName: 'markdown' })
hljs.registerAliases(['toml', 'conf'], { languageName: 'ini' })

// The type annotation is required: `highlight` refers to `md`, and
// TypeScript cannot infer a type from its own initializer.
const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  typographer: true,
  highlight(code: string, language: string): string {
    if (language && hljs.getLanguage(language)) {
      try {
        return hljs.highlight(code, { language, ignoreIllegals: true }).value
      } catch {
        /* fall through to the escaped text below */
      }
    }
    return md.utils.escapeHtml(code)
  },
})

md.use(anchor, {
  permalink: anchor.permalink.linkInsideHeader({
    symbol: '#',
    placement: 'after',
    class: 'heading-anchor',
    ariaHidden: true,
  }),
  slugify: (heading: string) =>
    heading
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section',
})

md.use(taskLists, { enabled: true, label: true })

// External links open in a new tab and do not leak the referrer.
type RenderRule = NonNullable<typeof md.renderer.rules.link_open>

const defaultLinkRenderer: RenderRule =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') ?? ''
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank')
    tokens[idx].attrSet('rel', 'noopener noreferrer')
  }
  return defaultLinkRenderer(tokens, idx, options, env, self)
}

// Keep link targets restricted to safe schemes.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(md.render(source ?? ''), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'id', 'class', 'align', 'colspan', 'rowspan', 'checked', 'disabled'],
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  })
}

export interface HeadingEntry {
  level: number
  text: string
  slug: string
}

/** Table of contents for the editor side panel. */
export function extractHeadings(source: string): HeadingEntry[] {
  const headings: HeadingEntry[] = []
  let insideFence = false

  for (const line of (source ?? '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      insideFence = !insideFence
      continue
    }
    if (insideFence) continue

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue

    const text = match[2].replace(/[*_`~[\]()]/g, '').trim()
    headings.push({
      level: match[1].length,
      text,
      slug:
        text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'section',
    })
  }

  return headings
}

export function countWords(source: string): number {
  const plain = (source ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`>~[\]()!-]/g, ' ')
    .trim()

  return plain === '' ? 0 : plain.split(/\s+/).length
}
