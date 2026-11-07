import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { pathToFileURL } from 'url'

/** The page the app itself loads: the dev server in development, the built index.html otherwise. */
function appOrigin(): { kind: 'dev'; origin: string } | { kind: 'file'; pathname: string } {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devUrl) return { kind: 'dev', origin: new URL(devUrl).origin }
  return {
    kind: 'file',
    pathname: pathToFileURL(join(__dirname, '../renderer/index.html')).pathname
  }
}

/** True only for the app's own pages (any hash), never for remote or unexpected URLs. */
export function isTrustedUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const app = appOrigin()
  return app.kind === 'dev'
    ? parsed.origin === app.origin
    : parsed.protocol === 'file:' && parsed.pathname === app.pathname
}
