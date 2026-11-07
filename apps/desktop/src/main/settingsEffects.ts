import { app, BrowserWindow } from 'electron'
import { IPC } from '../shared/ipc'
import { onSettingsChanged } from './settings'
import { refreshTrayMenu } from './tray'
import { checkForUpdates } from './updater'

/** Everything that has to happen when a setting changes, wherever the change came from. */
export function setupSettingsEffects(): void {
  onSettingsChanged((next, previous) => {
    // Keep every open window (main and settings) and the tray in sync.
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(IPC.settingsChanged, next))
    refreshTrayMenu()

    if (next.updateChannel !== previous.updateChannel) {
      void checkForUpdates()
    }
    if (next.launchAtLogin !== previous.launchAtLogin) {
      // Only packaged builds: in development this would register the Electron binary itself.
      if (app.isPackaged && process.platform !== 'linux') {
        app.setLoginItemSettings({ openAtLogin: next.launchAtLogin })
      }
    }
  })
}
