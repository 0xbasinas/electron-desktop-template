import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Settings } from '../shared/ipc'

const defaults: Settings = {
  theme: 'system',
  updateChannel: 'latest',
  closeToTray: false,
  launchAtLogin: false,
  crashReports: false
}
/** What is stored on disk: the user's settings plus bookkeeping the renderer never sets. */
interface Stored extends Settings {
  lastSeenVersion: string
  /** When the theme was last changed (ms since 1970); the account sync keeps the newest edit. */
  themeUpdatedAt: number
}

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

function readStored(): Stored {
  try {
    const saved = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<Stored>
    return {
      theme: saved.theme === 'light' || saved.theme === 'dark' ? saved.theme : 'system',
      themeUpdatedAt:
        typeof saved.themeUpdatedAt === 'number' && saved.themeUpdatedAt >= 0
          ? saved.themeUpdatedAt
          : 0,
      updateChannel: saved.updateChannel === 'beta' ? 'beta' : defaults.updateChannel,
      closeToTray: saved.closeToTray === true,
      launchAtLogin: saved.launchAtLogin === true,
      crashReports: saved.crashReports === true,
      lastSeenVersion: typeof saved.lastSeenVersion === 'string' ? saved.lastSeenVersion : ''
    }
  } catch {
    return { ...defaults, lastSeenVersion: '', themeUpdatedAt: 0 }
  }
}

function writeStored(stored: Stored): void {
  writeFileSync(settingsPath(), JSON.stringify(stored, null, 2))
}

export function getSettings(): Settings {
  const { theme, updateChannel, closeToTray, launchAtLogin, crashReports } = readStored()
  return { theme, updateChannel, closeToTray, launchAtLogin, crashReports }
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
  const themeChanged = next.theme !== previous.theme
  const stored = readStored()
  writeStored({
    ...stored,
    ...next,
    themeUpdatedAt: themeChanged ? Date.now() : stored.themeUpdatedAt
  })
  listeners.forEach((listener) => listener(next, previous))
  return next
}

/** The theme and when it was last changed, in the shape the account sync compares. */
export function getThemeRecord(): { theme: Settings['theme']; updatedAt: number } {
  const { theme, themeUpdatedAt } = readStored()
  return { theme, updatedAt: themeUpdatedAt }
}

/** A newer theme arrived from another device: adopt it with its own timestamp (so it is not pushed back as a new edit). */
export function applyRemoteTheme(theme: Settings['theme'], updatedAt: number): void {
  const previous = getSettings()
  writeStored({ ...readStored(), theme, themeUpdatedAt: updatedAt })
  const next = { ...previous, theme }
  if (theme !== previous.theme) listeners.forEach((listener) => listener(next, previous))
}

/** The last app version whose "what's new" screen the user has seen ("" on first run). */
export function getLastSeenVersion(): string {
  return readStored().lastSeenVersion
}

export function setLastSeenVersion(version: string): void {
  writeStored({ ...readStored(), lastSeenVersion: version })
}
