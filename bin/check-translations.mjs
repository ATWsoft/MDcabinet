#!/usr/bin/env node
/**
 * Verifies that the frontend translation dictionary is complete.
 *
 * Compares every t()/tn() key used in frontend/src with the keys defined in
 * frontend/src/locales/<locale>.ts and reports both directions:
 * keys without a translation, and translations no longer used anywhere.
 *
 * Run from the project root:
 *     node bin/check-translations.mjs
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'

const SRC = resolve('frontend/src')
const LOCALES = ['sk']

// t('...') – first string literal argument
const T_PATTERN = /\bt\(\s*'((?:[^'\\]|\\.)*)'/g
// tn(count, 'one', 'other') – the "one" form is the dictionary key
const TN_PATTERN = /\btn\(\s*[^,]+,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'/g
// Dictionary entries: 'Key': … or Key: … for plain identifiers
const DICT_QUOTED = /^ {2}'((?:[^'\\]|\\.)*)':/gm
const DICT_BARE = /^ {2}([A-Za-z][A-Za-z0-9]*):/gm

async function walk(dir) {
  const files = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(path)))
    else if (/\.tsx?$/.test(entry.name)) files.push(path)
  }
  return files
}

function matchAll(text, pattern, group = 1) {
  const found = []
  for (const match of text.matchAll(pattern)) found.push(match[group])
  return found
}

const files = await walk(SRC)
const localeFiles = LOCALES.map((locale) => resolve(SRC, 'locales', `${locale}.ts`))

const used = new Set()
for (const file of files) {
  if (localeFiles.includes(file)) continue
  const text = await readFile(file, 'utf8')
  for (const key of matchAll(text, TN_PATTERN)) used.add(key)
  for (const key of matchAll(text, T_PATTERN)) used.add(key)
}

let failed = false

for (const locale of LOCALES) {
  const text = await readFile(resolve(SRC, 'locales', `${locale}.ts`), 'utf8')
  const defined = new Set([...matchAll(text, DICT_QUOTED), ...matchAll(text, DICT_BARE)])

  const missing = [...used].filter((key) => !defined.has(key)).sort()
  const unused = [...defined].filter((key) => !used.has(key)).sort()

  console.log(`\n[${locale}] used: ${used.size}, defined: ${defined.size}`)

  if (missing.length > 0) {
    failed = true
    console.log(`  missing translations (${missing.length}):`)
    for (const key of missing) console.log(`    ${key}`)
  }
  if (unused.length > 0) {
    console.log(`  unused translations (${unused.length}):`)
    for (const key of unused) console.log(`    ${key}`)
  }
  if (missing.length === 0 && unused.length === 0) {
    console.log('  dictionary is in sync')
  }
}

process.exit(failed ? 1 : 0)
