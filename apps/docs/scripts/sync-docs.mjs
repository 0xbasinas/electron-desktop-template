// Copies /docs/*.md into src/content/docs as Starlight pages. The copies are generated (git ignores them);
// edit the files in /docs, never the copies. Runs before `dev`, `build` and `typecheck`.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toPage } from './sync-lib.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const from = join(here, '../../../docs')
const to = join(here, '../src/content/docs')

mkdirSync(to, { recursive: true })
for (const file of readdirSync(from).filter((f) => f.endsWith('.md'))) {
  const name = basename(file, '.md')
  writeFileSync(join(to, file), toPage(name, readFileSync(join(from, file), 'utf8')))
}
console.log('docs: synced')
