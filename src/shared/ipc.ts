// IPC channel names and payload types shared by main, preload and renderer.
// Add new channels here first so all three processes stay in sync.

export const IPC = {
  ping: 'ping',
  updaterCheck: 'updater:check',
  updaterEvent: 'updater:event',
  settingsGet: 'settings:get',
  settingsSetChannel: 'settings:set-channel',
  deepLink: 'deeplink:url',
  openFile: 'file:open'
} as const

export type UpdateChannel = 'latest' | 'beta'

export interface Settings {
  updateChannel: UpdateChannel
}

export type UpdaterEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
