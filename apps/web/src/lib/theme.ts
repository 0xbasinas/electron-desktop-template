import {
  emptyPreferences,
  preferencesRecordSchema,
  reconcile,
  type Preferences,
  type PreferencesRecord
} from '@repo/shared'
import { api } from './api'

// The theme follows the person: it is kept in this browser (so it applies at once, even signed out or offline) and,
// when signed in, synced through /api/preferences so the desktop app shows the same one. Last write wins.

const KEY = 'preferences'
const darkQuery = (): MediaQueryList | undefined =>
  window.matchMedia?.('(prefers-color-scheme: dark)')

function readLocal(): PreferencesRecord {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? preferencesRecordSchema.safeParse(JSON.parse(raw)) : null
    if (parsed?.success) return parsed.data
  } catch {
    // storage unavailable or corrupt: start from the defaults
  }
  return emptyPreferences()
}

function writeLocal(record: PreferencesRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    // private mode etc.: the theme still applies for this visit
  }
}

export function applyTheme(theme: Preferences['theme']): void {
  const dark = theme === 'dark' || (theme === 'system' && darkQuery()?.matches === true)
  document.documentElement.classList.toggle('dark', dark)
}

/** Apply the saved theme now, and keep following the OS setting while the theme is "system". */
export function initTheme(): void {
  applyTheme(readLocal().preferences.theme)
  darkQuery()?.addEventListener('change', () => applyTheme(readLocal().preferences.theme))
}

export const currentTheme = (): Preferences['theme'] => readLocal().preferences.theme

/** The person chose a theme: apply and remember it, then tell the server if signed in. Returns whether it was saved there. */
export async function setTheme(theme: Preferences['theme'], signedIn: boolean): Promise<boolean> {
  const record: PreferencesRecord = { preferences: { theme }, updatedAt: Date.now() }
  writeLocal(record)
  applyTheme(theme)
  if (!signedIn) return false
  try {
    writeLocal(await api.preferences.put(record))
    return true
  } catch (error) {
    // Offline or the API is down: the local copy is newer, so the next sync pushes it.
    console.error(error)
    return false
  }
}

/** After signing in (or on load while signed in): take the newest copy and, if ours is newer, send it. */
export async function syncTheme(): Promise<Preferences['theme']> {
  const local = readLocal()
  const remote = await api.preferences.get()
  const { winner, push } = reconcile(local, remote)
  const saved = push ? await api.preferences.put(winner) : winner
  writeLocal(saved)
  applyTheme(saved.preferences.theme)
  return saved.preferences.theme
}
