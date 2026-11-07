import { app, shell, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc'
import { flushPending, initDeepLinks } from './deeplink'
import { setupAutoUpdater } from './updater'
import { loadWindowState, trackWindowState } from './windowState'
import icon from '../../resources/icon.png?asset'

const isMac = process.platform === 'darwin'
let mainWindow: BrowserWindow | undefined

// Colors match --background in the renderer's theme so there is no white flash on startup.
const backgroundColor = (): string => (nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#ffffff')
const overlay = (): Electron.TitleBarOverlayOptions => ({
  color: backgroundColor(),
  symbolColor: nativeTheme.shouldUseDarkColors ? '#fafafa' : '#0a0a0a',
  height: 40
})

function createWindow(): void {
  const state = loadWindowState()
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 480,
    minHeight: 360,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: backgroundColor(),
    // Custom title bar: the renderer draws it; the OS still provides the window controls.
    titleBarStyle: 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 14, y: 12 } } : { titleBarOverlay: overlay() }),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow = win
  if (state.isMaximized) win.maximize()
  trackWindowState(win)

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => (mainWindow = undefined))
  win.webContents.on('did-finish-load', flushPending)

  if (!isMac) {
    nativeTheme.on('updated', () => win.setTitleBarOverlay(overlay()))
  }

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Only one instance: a second launch (e.g. clicking a deep link) is forwarded to the first.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  initDeepLinks(() => mainWindow)

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.0xbasinas.electron-desktop-template')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    ipcMain.on(IPC.ping, () => console.log('pong'))

    createWindow()
    setupAutoUpdater()

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Quit when all windows are closed, except on macOS, where apps stay active until Cmd + Q.
  app.on('window-all-closed', () => {
    if (!isMac) app.quit()
  })
}
