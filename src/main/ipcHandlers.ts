import { app, BrowserWindow } from 'electron'
import { IPC, type AppInfo } from '../shared/ipc'
import { parseBoolean, parseSettingsPatch } from '../shared/validate'
import { logFilePath, revealLogs } from './logger'
import { handle } from './secureIpc'
import { getSettings, updateSettings } from './settings'
import { openSettingsWindow } from './settingsWindow'
import { getWhatsNew, markWhatsNewSeen } from './whatsNew'

/** Handlers for settings, app info and "what's new". Update handlers live in updater.ts. */
export function registerIpcHandlers(): void {
  handle(IPC.settingsGet, () => getSettings())

  // The renderer sends a patch; parseSettingsPatch rejects anything unexpected.
  handle(IPC.settingsUpdate, (_event, patch) => updateSettings(parseSettingsPatch(patch)))

  handle(IPC.settingsOpenWindow, (event) => {
    openSettingsWindow(BrowserWindow.fromWebContents(event.sender) ?? undefined)
  })

  handle(IPC.appInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
    logPath: logFilePath()
  }))

  handle(IPC.appOpenLogs, () => revealLogs())

  handle(IPC.whatsNewGet, (_event, force) => getWhatsNew(parseBoolean(force)))
  handle(IPC.whatsNewSeen, () => markWhatsNewSeen())
}
