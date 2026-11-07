# Architecture

An Electron app runs three kinds of code. Knowing which one you are writing is most of the battle.

```
┌──────────────────────────── Main process (src/main) ────────────────────────────┐
│ Node.js with full OS access: windows, files, auto-update, deep links, settings. │
└───────────────▲──────────────────────────────────────────────┬──────────────────┘
                │ ipcMain.handle / webContents.send            │
        ┌───────┴──────────────── Preload (src/preload) ───────▼──────┐
        │ Runs before the page loads. Exposes a small, typed `window.api`. │
        └───────▲──────────────────────────────────────────────┬──────┘
                │ ipcRenderer.invoke / on                      │
┌───────────────┴───────────── Renderer (src/renderer) ────────▼──────────────────┐
│ A sandboxed web page (React). No Node access. Talks to main only via window.api. │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Shared types and channel names live in `src/shared/ipc.ts`, which all three import.

## Folders

| Path                                               | What lives there                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/main/index.ts`                                | App startup, the window (custom title bar, no white flash), single-instance lock                     |
| `src/main/updater.ts`                              | `electron-updater`: stable vs beta channel, differential downloads, update events                    |
| `src/main/deeplink.ts`                             | `myapp://` links and file associations, on macOS, Windows and Linux                                  |
| `src/main/menu.ts`                                 | The application menu (File, Edit, View, Window, Help) and its keyboard accelerators                  |
| `src/main/tray.ts`                                 | System tray icon and menu, plus the optional "keep running when closed" setting                      |
| `src/main/shortcuts.ts`                            | The global show/hide shortcut                                                                        |
| `src/main/windowUtils.ts`                          | `showWindow`, `toggleWindow` and `requestUpdateCheck`, shared by menu, tray, shortcut and deep links |
| `src/main/windowState.ts`                          | Remembers window size, position and maximized state between launches                                 |
| `src/main/settings.ts`                             | Tiny JSON settings file in the user data folder                                                      |
| `src/main/secureIpc.ts`                            | `handle()`: `ipcMain.handle` that rejects calls not coming from our own page                         |
| `src/main/trust.ts`                                | `isTrustedUrl()`: which page URLs may talk to main                                                   |
| `src/main/windowChrome.ts`                         | Shared window options (sandbox, title bar), `hardenWindow`, `loadRenderer`                           |
| `src/main/ipcHandlers.ts`                          | Handlers for settings, app info, logs and what's new                                                 |
| `src/main/settingsWindow.ts`, `settingsEffects.ts` | The Settings window, and what changing a setting does                                                |
| `src/main/logger.ts`                               | `electron-log`: log file, rotation, uncaught errors, "Show Log File"                                 |
| `src/main/whatsNew.ts`                             | Release notes and first-run state                                                                    |
| `src/shared/validate.ts`                           | Checks for payloads coming from the renderer                                                         |
| `src/preload/api.ts`                               | The `window.api` surface. Everything the page can ask main to do is listed here                      |
| `src/preload/index.ts`                             | Exposes `api` with `contextBridge`                                                                   |
| `src/shared/ipc.ts`                                | Channel names and payload types                                                                      |
| `src/renderer/`                                    | The React app, Tailwind and shadcn/ui                                                                |
| `build/`                                           | App icons (generated) and macOS entitlements                                                         |
| `scripts/`                                         | Rename, icon generation and bundle-size scripts                                                      |

## How IPC flows

There are two directions, and both go through the preload script.

**Renderer asks, main answers** (request/response):

```
Toggle click → window.api.updateSettings({ updateChannel: 'beta' })
  → preload: ipcRenderer.invoke(IPC.settingsUpdate, patch)
  → main:    handle(IPC.settingsUpdate, ...) checks the sender, validates the patch, saves it,
             and settingsEffects re-checks for updates and tells every window
  → the returned Settings object resolves the promise in the renderer
```

**Main pushes, renderer listens** (events):

```
autoUpdater 'download-progress'
  → main:     webContents.send(IPC.updaterEvent, { type: 'progress', percent })
  → preload:  window.api.onUpdaterEvent(cb) subscribed with ipcRenderer.on
  → renderer: React state updates and the UI shows the percentage
```

Deep links and opened files use the same push pattern. If a link arrives before the window has
finished loading, `deeplink.ts` queues it and delivers it on `did-finish-load`.

## Adding a new IPC call

1. Add the channel name (and any payload type) to `src/shared/ipc.ts`.
2. Handle it in main with `handle(IPC.yourChannel, ...)` from `secureIpc.ts` (not `ipcMain.handle`), and
   validate every argument with a function in `src/shared/validate.ts`. Treat the renderer as untrusted.
3. Expose a typed function in `src/preload/api.ts`.
4. Call `window.api.yourFunction()` from the renderer. The types flow through automatically.

Keep the preload surface small and specific. Expose "do this one thing" functions, never raw
`ipcRenderer` or file-system access.

## Window and title bar

The window uses `titleBarStyle: 'hidden'`, so the renderer draws the bar (`TitleBar.tsx`) and the OS
still draws the window controls: traffic lights on macOS, an overlay on Windows and Linux. The
bar is a drag region (`.app-drag`); interactive children are excluded automatically. The window
background color matches the theme, and `index.html` has an inline splash, so there is no white flash
while React starts.

## Deep links and file associations

- Scheme: `PROTOCOL` in `src/main/deeplink.ts`, mirrored under `protocols` in `electron-builder.yml`.
- File types: `FILE_EXTENSIONS` in `deeplink.ts`, mirrored under `fileAssociations`.
- Only one instance runs. Windows and Linux deliver links in `argv` (via `second-instance`), macOS
  uses `open-url` and `open-file`.
- Try it on a packaged build: open `electron-desktop-template://hello` from a browser or run it from a terminal.
  Protocol registration for a dev build (`pnpm dev`) works on Windows and Linux but is flaky on macOS.

## Menu, tray and shortcuts

- **Menu** (`menu.ts`): standard roles for Edit, View and Window, plus _Open File..._ (`Ctrl/Cmd+O`) and Help links.
  Reload and DevTools only exist in development. On Windows and Linux the bar is hidden by the custom title
  bar, but the accelerators still work.
- **Tray** (`tray.ts`): click to show or hide the window; the right-click menu has Show, Check for Updates, the
  _Keep running in the tray when closed_ option (stored as `closeToTray` in the settings file) and Quit.
  If the desktop has no tray, creating it fails quietly and the app carries on without one.
- **Shortcut** (`shortcuts.ts`): `Ctrl/Cmd+Shift+Space` shows or hides the window from anywhere.
  Change `TOGGLE_WINDOW_SHORTCUT` to use another one. If another app already owns it, a warning is logged.
- "Check for Updates" in the menu or tray goes through the renderer (`menu:check-updates`), so you see the
  result in the update banner like a normal check.

## Security model

- Windows use `sandbox: true`, `contextIsolation: true` and `nodeIntegration: false`. A sandboxed preload can
  only import `electron` and bundled code, which is why `src/preload` imports nothing else.
- `handle()` only answers the main frame of a page loaded from our own bundle (or the dev server in
  development). Anything else, such as an iframe or a navigated-away page, is rejected.
- **Electron fuses** are set in `electron-builder.yml` (`electronFuses`) and written into the executable before signing:
  `runAsNode` and `NODE_OPTIONS` are off (so the app cannot be hijacked to run arbitrary Node code), cookies are encrypted,
  and the Node inspector flags are off in releases. **ASAR integrity** is on with `onlyLoadAppFromAsar`: the app refuses to
  start if `app.asar` was modified (it exits with "Integrity check failed for asar archive"). `grantFileProtocolExtraPrivileges`
  stays on because the renderer loads from `file://`; a custom `app://` protocol would let you turn it off.
  `scripts/lib/fuses.mjs` lists the expected state and CI checks it on the packaged app.
- Payloads are validated in main (`parseSettingsPatch`), never trusted because the TypeScript type says so.
- New windows and navigations are blocked by `hardenWindow`; only `http(s)` links open in the browser.
- The page has a Content-Security-Policy in `index.html`.

## Settings window

The Settings window is the same renderer bundle loaded with the `#settings` hash (`main.tsx` picks
`SettingsWindow` instead of `App`), so it shares the theme, components and preload. It holds the update
channel, tray and launch-at-login options, update check, log file and what's new. Changes go through
`settings:update`, and `settingsEffects.ts` applies them (tray menu, channel re-check, login item) and
broadcasts `settings:changed` so every window and the tray stay in sync.

## Logging

`logger.ts` sets up `electron-log`: logs go to a file (2 MB, rotated), `console.*` in main is routed to it,
uncaught errors and renderer crashes are written there, and the updater logs through it. Help > Show Log File
reveals it. Nothing is sent anywhere; point `log.transports.remote` at a server if you want that.

## First run and what's new

`whatsNew.ts` compares the stored `lastSeenVersion` with the running version. No stored version means first
run (welcome); a different one means the app was updated (release notes); the same one shows nothing. Closing
the dialog marks the version as seen.
