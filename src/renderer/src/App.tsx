import { useEffect, useState } from 'react'
import type { UpdateChannel, UpdaterEvent } from '../../shared/ipc'
import logo from './assets/logo.png'
import { Button } from '@renderer/components/ui/button'
import { TitleBar } from '@renderer/components/TitleBar'

function describe(event: UpdaterEvent | undefined): string {
  switch (event?.type) {
    case 'checking':
      return 'Checking for updates...'
    case 'available':
      return `Downloading ${event.version}...`
    case 'progress':
      return `Downloading update: ${Math.round(event.percent)}%`
    case 'downloaded':
      return `${event.version} is ready and installs when you quit.`
    case 'not-available':
      return 'You are up to date.'
    case 'error':
      return `Update error: ${event.message}`
    default:
      return ''
  }
}

function App(): React.JSX.Element {
  const { electron, chrome, node } = window.electron.process.versions
  const [channel, setChannel] = useState<UpdateChannel>('latest')
  const [update, setUpdate] = useState<UpdaterEvent>()
  const [opened, setOpened] = useState<string>()

  useEffect(() => {
    void window.api.getSettings().then((s) => setChannel(s.updateChannel))
    const offUpdate = window.api.onUpdaterEvent(setUpdate)
    const offLink = window.api.onDeepLink((url) => setOpened(`Deep link: ${url}`))
    const offFile = window.api.onOpenFile((path) => setOpened(`Opened file: ${path}`))
    return () => {
      offUpdate()
      offLink()
      offFile()
    }
  }, [])

  const toggleChannel = async (): Promise<void> => {
    const next: UpdateChannel = channel === 'beta' ? 'latest' : 'beta'
    const settings = await window.api.setUpdateChannel(next)
    setChannel(settings.updateChannel)
  }

  return (
    <>
      <TitleBar />
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 pt-16">
        <img src={logo} alt="" className="size-20 rounded-2xl" />
        <h1 className="text-3xl font-semibold tracking-tight">Electron Desktop Template</h1>
        <p className="max-w-md text-center text-muted-foreground">
          Electron + Vite + React + TypeScript + Tailwind + shadcn/ui, with auto-updates and CI.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.electron.ipcRenderer.send('ping')}>Send IPC ping</Button>
          <Button variant="outline" onClick={() => window.api.checkForUpdates()}>
            Check for updates
          </Button>
          <Button variant="secondary" onClick={toggleChannel}>
            Update channel: {channel === 'beta' ? 'beta' : 'stable'}
          </Button>
        </div>
        {update && <p className="text-sm text-muted-foreground">{describe(update)}</p>}
        {opened && <p className="max-w-md break-all text-center text-sm">{opened}</p>}
        <p className="text-xs text-muted-foreground">
          Electron {electron} · Chromium {chrome} · Node {node}
        </p>
      </main>
    </>
  )
}

export default App
