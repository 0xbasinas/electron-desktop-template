import { ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type Settings, type UpdateChannel, type UpdaterEvent } from '../shared/ipc'

/** Subscribe to a main -> renderer channel. Returns an unsubscribe function. */
const subscribe = <T>(channel: string, callback: (payload: T) => void): (() => void) => {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

// Custom APIs for renderer. Keep this surface small: it is everything the page can ask main to do.
export const api = {
  platform: process.platform,
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke(IPC.updaterCheck),
  getUpdaterStatus: (): Promise<UpdaterEvent | undefined> => ipcRenderer.invoke(IPC.updaterStatus),
  installUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.updaterInstall),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.settingsGet),
  setUpdateChannel: (channel: UpdateChannel): Promise<Settings> =>
    ipcRenderer.invoke(IPC.settingsSetChannel, channel),
  onUpdaterEvent: (cb: (event: UpdaterEvent) => void): (() => void) =>
    subscribe(IPC.updaterEvent, cb),
  onDeepLink: (cb: (url: string) => void): (() => void) => subscribe(IPC.deepLink, cb),
  onOpenFile: (cb: (path: string) => void): (() => void) => subscribe(IPC.openFile, cb)
}

export type Api = typeof api
