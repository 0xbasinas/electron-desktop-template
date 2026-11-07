#!/usr/bin/env node
// Release dry run: after `electron-builder --<os> --publish never`, check that what a release would
// upload is consistent, so packaging mistakes fail on the pull request instead of after the merge.
//   - the update manifest exists and matches the app version
//   - every file it lists exists, with the same size and sha512
//   - installers have blockmaps (differential updates)
//   - the unpacked app carries app-update.yml and the release notes
// Usage: node scripts/check-release-artifacts.mjs [dist-folder]
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { checkManifest, parseManifest } from './lib/manifest.mjs'

const dist = process.argv[2] ?? 'dist'
const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const platform = process.platform
const expectedManifest =
  platform === 'win32'
    ? 'latest.yml'
    : platform === 'darwin'
      ? 'latest-mac.yml'
      : 'latest-linux.yml'

const problems = []

if (!existsSync(dist)) {
  console.error(`No build folder at ${dist}. Run electron-builder first.`)
  process.exit(1)
}

// Hash every top-level file once.
const files = new Map()
for (const name of readdirSync(dist)) {
  const path = join(dist, name)
  if (!statSync(path).isFile()) continue
  files.set(name, {
    size: statSync(path).size,
    sha512: createHash('sha512').update(readFileSync(path)).digest('base64')
  })
}

if (!files.has(expectedManifest)) {
  problems.push(
    `${expectedManifest} was not produced (found: ${[...files.keys()].join(', ') || 'nothing'})`
  )
} else {
  const manifest = parseManifest(readFileSync(join(dist, expectedManifest), 'utf8'))
  problems.push(...checkManifest(manifest, { version, files }))
  console.log(`${expectedManifest}: ${manifest.files.length} file(s), version ${manifest.version}`)
}

// The unpacked app is what `electron-updater` reads its feed from, and what the what's-new screen reads.
const unpackedResources = [
  join(dist, 'win-unpacked', 'resources'),
  join(dist, 'linux-unpacked', 'resources'),
  ...readdirSync(dist)
    .filter((d) => d.startsWith('mac'))
    .map((d) =>
      join(
        dist,
        d,
        readdirSync(join(dist, d)).find((a) => a.endsWith('.app')) ?? '',
        'Contents',
        'Resources'
      )
    )
].find((dir) => existsSync(dir))

if (!unpackedResources) {
  problems.push('could not find the unpacked app resources folder')
} else {
  for (const required of ['app-update.yml', 'release-notes.md', 'app.asar']) {
    if (!existsSync(join(unpackedResources, required))) {
      problems.push(`${required} is missing from the packaged app (${unpackedResources})`)
    }
  }
}

if (problems.length) {
  console.error('\nRelease dry run found problems:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('Release dry run: everything agrees.')
