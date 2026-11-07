import { useEffect, useState } from 'react'

/**
 * Custom title bar. The main process hides the native frame; the OS still draws the window
 * controls (traffic lights on macOS, an overlay on Windows and Linux), so we only reserve room.
 */
export function TitleBar(): React.JSX.Element {
  const [title, setTitle] = useState(document.title)
  const isMac = window.api.platform === 'darwin'

  useEffect(() => {
    const observer = new MutationObserver(() => setTitle(document.title))
    observer.observe(document.querySelector('title')!, { childList: true })
    return () => observer.disconnect()
  }, [])

  return (
    <header
      className="app-drag fixed inset-x-0 top-0 z-50 flex h-10 items-center border-b bg-background/80 text-xs font-medium backdrop-blur select-none"
      style={{
        paddingLeft: isMac ? 80 : 12,
        // On Windows/Linux, leave room for the window-controls overlay.
        paddingRight: isMac
          ? 12
          : 'calc(100% - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100%) + 8px)'
      }}
    >
      <span className="truncate text-muted-foreground">{title}</span>
    </header>
  )
}
