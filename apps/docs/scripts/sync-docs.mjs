// Copies /docs/**/*.md into src/content/docs as Starlight pages (folders stay folders). The copies are generated
// (git ignores them); edit the files in /docs, never the copies. Runs before `dev`, `build` and `typecheck`.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toPage } from './sync-lib.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const from = join(here, '../../../docs')
const to = join(here, '../src/content/docs')

/** Every .md file under a folder, as paths relative to it. */
function listMarkdown(root, dir = root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listMarkdown(root, join(dir, entry.name))
      : entry.name.endsWith('.md')
        ? [relative(root, join(dir, entry.name))]
        : []
  )
}

// Only index.mdx (the home page) is written by hand; everything else here is generated, so start clean.
for (const entry of readdirSync(to))
  if (entry !== 'index.mdx') rmSync(join(to, entry), { recursive: true })

for (const file of listMarkdown(from)) {
  const slug = file.replaceAll('\\', '/').replace(/\.md$/, '')
  mkdirSync(dirname(join(to, file)), { recursive: true })
  writeFileSync(join(to, file), toPage(slug, readFileSync(join(from, file), 'utf8')))
}
console.log('docs: synced')
