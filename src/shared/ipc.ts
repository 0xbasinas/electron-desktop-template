// IPC channel names and payload types shared by main, preload and renderer.
// Add new channels here first so all three processes stay in sync.

export const IPC = {
  // renderer -> main (invoke)
  updaterCheck: 'updater:check',
  updaterStatus: 'updater:status',
  updaterInstall: 'updater:install',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsOpenWindow: 'settings:open-window',
  appInfo: 'app:info',
  appOpenLogs: 'app:open-logs',
  whatsNewGet: 'whats-new:get',
  whatsNewSeen: 'whats-new:seen',
  // main -> renderer (events)
  updaterEvent: 'updater:event',
  settingsChanged: 'settings:changed',
  menuCheckUpdates: 'menu:check-updates',
  menuWhatsNew: 'menu:whats-new',
  deepLink: 'deeplink:url',
  openFile: 'file:open'
} as const

export type UpdateChannel = 'latest' | 'beta'

/** User preferences. Everything here can be changed from the settings window. */
export interface Settings {
  updateChannel: UpdateChannel
  /** Closing the window hides it to the tray instead of quitting (Windows and Linux). */
  closeToTray: boolean
  /** Start the app when you sign in (Windows and macOS, packaged builds only). */
  launchAtLogin: boolean
}

export type UpdaterEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

export interface AppInfo {
  name: string
  version: string
  platform: string
  isPackaged: boolean
  logPath: string
}

export interface WhatsNew {
  /** "first-run" the first time the app ever starts, "updated" after the version changes. */
  kind: 'first-run' | 'updated'
  version: string
  /** Release notes as Markdown. */
  notes: string
}
