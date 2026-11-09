// Copies /docs/**/*.md into src/content/docs as Starlight pages (folders stay folders), and every saved version in
// /docs-versions/<slug>/** into src/content/docs/<slug>/**. The copies are generated (git ignores them); edit the files
// in /docs, never the copies. Runs before `dev`, `build` and `typecheck`.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toPage } from './sync-lib.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = join(here, '../../..')
const to = join(here, '../src/content/docs')
const versions = JSON.parse(readFileSync(join(here, '../versions.json'), 'utf8')).versions

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

const latest = new Set(
  listMarkdown(join(repo, 'docs')).map((f) => f.replaceAll('\\', '/').replace(/\.md$/, ''))
)

/** Writes one folder of Markdown as pages, under a prefix, with options that depend on the page. */
function writePages(folder, prefix, optionsFor) {
  for (const file of listMarkdown(folder)) {
    const slug = file.replaceAll('\\', '/').replace(/\.md$/, '')
    const out = join(to, prefix, file)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(
      out,
      toPage(`${prefix}${slug}`, readFileSync(join(folder, file), 'utf8'), optionsFor(slug))
    )
  }
}

writePages(join(repo, 'docs'), '', () => ({}))

for (const version of versions) {
  const folder = join(repo, 'docs-versions', version.slug)
  if (!existsSync(folder)) {
    console.error(
      `versions.json lists "${version.slug}" but docs-versions/${version.slug} does not exist.`
    )
    process.exit(1)
  }
  writePages(folder, `${version.slug}/`, (slug) => ({
    editPath: `docs-versions/${version.slug}/${slug}.md`,
    search: false,
    banner: `You are reading the docs for <strong>${version.label}</strong>. <a href="/${latest.has(slug) ? `${slug}/` : ''}">See the latest version</a>.`
  }))
}
console.log(
  `docs: synced${versions.length ? ` (${versions.length} saved version${versions.length === 1 ? '' : 's'})` : ''}`
)
