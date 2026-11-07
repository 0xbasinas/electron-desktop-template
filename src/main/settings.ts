import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Settings } from '../shared/ipc'

const defaults: Settings = { updateChannel: 'latest' }

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

export function getSettings(): Settings {
  try {
    const saved = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<Settings>
    return {
      updateChannel: saved.updateChannel === 'beta' ? 'beta' : defaults.updateChannel
    }
  } catch {
    return { ...defaults }
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2))
  return next
}
