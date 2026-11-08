import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ACCENTS } from '@repo/shared'
import type { Settings } from '../shared/ipc'

const defaults: Settings = {
  theme: 'system',
  accent: 'neutral',
  updateChannel: 'latest',
  closeToTray: false,
  launchAtLogin: false,
  crashReports: false
}
/** What is stored on disk: the user's settings plus bookkeeping the renderer never sets. */
interface Stored extends Settings {
  lastSeenVersion: string
  /** When the theme or accent was last changed (ms since 1970); the account sync keeps the newest edit. */
  preferencesUpdatedAt: number
}

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

function readStored(): Stored {
  try {
    // `themeUpdatedAt` is what older versions called `preferencesUpdatedAt`.
    const saved = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<Stored> & {
      themeUpdatedAt?: number
    }
    const updatedAt = saved.preferencesUpdatedAt ?? saved.themeUpdatedAt
    return {
      theme: saved.theme === 'light' || saved.theme === 'dark' ? saved.theme : 'system',
      accent: ACCENTS.find((a) => a === saved.accent) ?? defaults.accent,
      preferencesUpdatedAt: typeof updatedAt === 'number' && updatedAt >= 0 ? updatedAt : 0,
      updateChannel: saved.updateChannel === 'beta' ? 'beta' : defaults.updateChannel,
      closeToTray: saved.closeToTray === true,
      launchAtLogin: saved.launchAtLogin === true,
      crashReports: saved.crashReports === true,
      lastSeenVersion: typeof saved.lastSeenVersion === 'string' ? saved.lastSeenVersion : ''
    }
  } catch {
    return { ...defaults, lastSeenVersion: '', preferencesUpdatedAt: 0 }
  }
}

function writeStored(stored: Stored): void {
  writeFileSync(settingsPath(), JSON.stringify(stored, null, 2))
}

export function getSettings(): Settings {
  const { theme, accent, updateChannel, closeToTray, launchAtLogin, crashReports } = readStored()
  return { theme, accent, updateChannel, closeToTray, launchAtLogin, crashReports }
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
  const preferencesChanged = next.theme !== previous.theme || next.accent !== previous.accent
  const stored = readStored()
  writeStored({
    ...stored,
    ...next,
    preferencesUpdatedAt: preferencesChanged ? Date.now() : stored.preferencesUpdatedAt
  })
  listeners.forEach((listener) => listener(next, previous))
  return next
}

/** The synced preferences (theme, accent) and when they were last changed, in the shape the account sync compares. */
export function getPreferencesRecord(): {
  theme: Settings['theme']
  accent: Settings['accent']
  updatedAt: number
} {
  const { theme, accent, preferencesUpdatedAt } = readStored()
  return { theme, accent, updatedAt: preferencesUpdatedAt }
}

/** Newer preferences arrived from another device: adopt them with their own timestamp (so they are not pushed back as a new edit). */
export function applyRemotePreferences(
  prefs: Pick<Settings, 'theme' | 'accent'>,
  updatedAt: number
): void {
  const previous = getSettings()
  writeStored({ ...readStored(), ...prefs, preferencesUpdatedAt: updatedAt })
  const next = { ...previous, ...prefs }
  if (next.theme !== previous.theme || next.accent !== previous.accent) {
    listeners.forEach((listener) => listener(next, previous))
  }
}

/** The last app version whose "what's new" screen the user has seen ("" on first run). */
export function getLastSeenVersion(): string {
  return readStored().lastSeenVersion
}

export function setLastSeenVersion(version: string): void {
  writeStored({ ...readStored(), lastSeenVersion: version })
}
