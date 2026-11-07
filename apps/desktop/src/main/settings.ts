import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Settings } from '../shared/ipc'

const defaults: Settings = {
  updateChannel: 'latest',
  closeToTray: false,
  launchAtLogin: false,
  crashReports: false
}
/** What is stored on disk: the user's settings plus bookkeeping the renderer never sets. */
interface Stored extends Settings {
  lastSeenVersion: string
}

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

function readStored(): Stored {
  try {
    const saved = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<Stored>
    return {
      updateChannel: saved.updateChannel === 'beta' ? 'beta' : defaults.updateChannel,
      closeToTray: saved.closeToTray === true,
      launchAtLogin: saved.launchAtLogin === true,
      crashReports: saved.crashReports === true,
      lastSeenVersion: typeof saved.lastSeenVersion === 'string' ? saved.lastSeenVersion : ''
    }
  } catch {
    return { ...defaults, lastSeenVersion: '' }
  }
}

function writeStored(stored: Stored): void {
  writeFileSync(settingsPath(), JSON.stringify(stored, null, 2))
}

export function getSettings(): Settings {
  const { updateChannel, closeToTray, launchAtLogin, crashReports } = readStored()
  return { updateChannel, closeToTray, launchAtLogin, crashReports }
}

type Listener = (next: Settings, previous: Settings) => void
const listeners = new Set<Listener>()

/** Run `listener` whenever settings change, from the settings window, the tray, or anywhere else. */
export function onSettingsChanged(listener: Listener): void {
  listeners.add(listener)
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const previous = getSettings()
  const next: Settings = { ...previous, ...patch }
  writeStored({ ...readStored(), ...next })
  listeners.forEach((listener) => listener(next, previous))
  return next
}

/** The last app version whose "what's new" screen the user has seen ("" on first run). */
export function getLastSeenVersion(): string {
  return readStored().lastSeenVersion
}

export function setLastSeenVersion(version: string): void {
  writeStored({ ...readStored(), lastSeenVersion: version })
}
