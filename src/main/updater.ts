import { app, BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'

export function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const notify = (channel: string, payload?: unknown): void => {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, payload))
  }

  autoUpdater.on('update-available', (info) => notify('updater:available', info.version))
  autoUpdater.on('download-progress', (p) => notify('updater:progress', p.percent))
  autoUpdater.on('update-downloaded', (info) => notify('updater:downloaded', info.version))
  autoUpdater.on('error', (err) => console.error('[updater]', err))

  // Updates only work in packaged builds.
  const check = (): void => {
    if (is.dev || !app.isPackaged) return
    autoUpdater.checkForUpdates().catch((err) => console.error('[updater]', err))
  }

  ipcMain.handle('updater:check', check)
  check()
}
