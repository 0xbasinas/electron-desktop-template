#!/usr/bin/env node
// Generate every app icon from one source image.
// Usage: pnpm icons [path/to/source.svg|png]   (default: build/icon-source.svg, ideally 1024x1024)
// Writes: build/icon.png, build/icon.ico, build/icon.icns, resources/icon.png
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import png2icons from 'png2icons'

const source = process.argv[2] ?? 'build/icon-source.svg'

const render = (size) =>
  sharp(readFileSync(source), { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

const master = await render(1024)

writeFileSync('build/icon.png', master)
writeFileSync('resources/icon.png', await render(512))

const ico = png2icons.createICO(master, png2icons.BICUBIC, 0, false, true)
const icns = png2icons.createICNS(master, png2icons.BICUBIC, 0)
if (!ico || !icns) {
  console.error('Failed to create .ico/.icns - is the source image square and at least 512x512?')
  process.exit(1)
}
writeFileSync('build/icon.ico', ico)
writeFileSync('build/icon.icns', icns)

console.log(`Icons generated from ${source}:`)
console.log('  build/icon.png  build/icon.ico  build/icon.icns  resources/icon.png')
