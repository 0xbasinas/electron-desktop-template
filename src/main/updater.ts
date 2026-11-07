import { app, BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { IPC, type UpdateChannel, type UpdaterEvent } from '../shared/ipc'
import { getSettings, updateSettings } from './settings'

function applyChannel(channel: UpdateChannel): void {
  // "latest" = stable releases only. "beta" also accepts pre-releases published from the beta branch.
  autoUpdater.channel = channel
  autoUpdater.allowPrerelease = channel === 'beta'
}

export function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  // Differential (blockmap) downloads are on by default; keep it explicit so nobody turns it off by accident.
  autoUpdater.disableDifferentialDownload = false

  const send = (event: UpdaterEvent): void => {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(IPC.updaterEvent, event))
  }

  autoUpdater.on('checking-for-update', () => send({ type: 'checking' }))
  autoUpdater.on('update-available', (info) => send({ type: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => send({ type: 'not-available' }))
  autoUpdater.on('download-progress', (p) => send({ type: 'progress', percent: p.percent }))
  autoUpdater.on('update-downloaded', (info) => send({ type: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) => {
    console.error('[updater]', err)
    send({ type: 'error', message: err.message })
  })

  // Updates only work in packaged builds.
  const check = async (): Promise<void> => {
    if (is.dev || !app.isPackaged) return
    applyChannel(getSettings().updateChannel)
    await autoUpdater.checkForUpdates().catch((err) => console.error('[updater]', err))
  }

  ipcMain.handle(IPC.updaterCheck, check)
  ipcMain.handle(IPC.settingsGet, () => getSettings())
  ipcMain.handle(IPC.settingsSetChannel, async (_event, channel: UpdateChannel) => {
    const settings = updateSettings({ updateChannel: channel === 'beta' ? 'beta' : 'latest' })
    await check()
    return settings
  })

  void check()
}
