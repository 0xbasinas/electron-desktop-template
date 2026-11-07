import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron'
import icon from '../../resources/icon.png?asset'
import { getSettings, updateSettings } from './settings'
import { requestUpdateCheck, showWindow, toggleWindow } from './windowUtils'

// Keep a reference, otherwise the tray icon is garbage collected and disappears.
let tray: Tray | undefined

export function setupTray(getWindow: () => BrowserWindow | undefined): void {
  try {
    createTray(getWindow)
  } catch (error) {
    // Some Linux desktops have no tray. The app works fine without one.
    console.warn('[tray] Could not create the tray icon', error)
  }
}

function createTray(getWindow: () => BrowserWindow | undefined): void {
  const size = process.platform === 'darwin' ? 18 : 16
  tray = new Tray(nativeImage.createFromPath(icon).resize({ width: size, height: size }))
  tray.setToolTip(app.name)

  const withWindow = (fn: (win: BrowserWindow) => void) => (): void => {
    const win = getWindow()
    if (win) fn(win)
  }

  const menu = Menu.buildFromTemplate([
    { label: `Show ${app.name}`, click: withWindow(showWindow) },
    { label: 'Check for Updates...', click: withWindow(requestUpdateCheck) },
    { type: 'separator' },
    {
      label: 'Keep running in the tray when closed',
      type: 'checkbox',
      checked: getSettings().closeToTray,
      // Windows and Linux only: on macOS apps already stay running after the window closes.
      visible: process.platform !== 'darwin',
      click: (item) => {
        updateSettings({ closeToTray: item.checked })
      }
    },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ])
  tray.setContextMenu(menu)

  // Left click toggles the window on Windows. (On macOS a click opens the menu instead.)
  tray.on('click', withWindow(toggleWindow))
}
