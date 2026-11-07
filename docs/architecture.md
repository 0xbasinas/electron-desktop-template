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

| Path                      | What lives there                                                                  |
| ------------------------- | --------------------------------------------------------------------------------- |
| `src/main/index.ts`       | App startup, the window (custom title bar, no white flash), single-instance lock  |
| `src/main/updater.ts`     | `electron-updater`: stable vs beta channel, differential downloads, update events |
| `src/main/deeplink.ts`    | `myapp://` links and file associations, on macOS, Windows and Linux               |
| `src/main/windowState.ts` | Remembers window size, position and maximized state between launches              |
| `src/main/settings.ts`    | Tiny JSON settings file in the user data folder                                   |
| `src/preload/api.ts`      | The `window.api` surface. Everything the page can ask main to do is listed here   |
| `src/preload/index.ts`    | Exposes `api` with `contextBridge`                                                |
| `src/shared/ipc.ts`       | Channel names and payload types                                                   |
| `src/renderer/`           | The React app, Tailwind and shadcn/ui                                             |
| `build/`                  | App icons (generated) and macOS entitlements                                      |
| `scripts/`                | Rename, icon generation and bundle-size scripts                                   |

## How IPC flows

There are two directions, and both go through the preload script.

**Renderer asks, main answers** (request/response):

```
Button click → window.api.setUpdateChannel('beta')
  → preload: ipcRenderer.invoke(IPC.settingsSetChannel, 'beta')
  → main:    ipcMain.handle(IPC.settingsSetChannel, ...) saves it, re-checks for updates
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
2. Handle it in main with `ipcMain.handle(IPC.yourChannel, ...)`.
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
