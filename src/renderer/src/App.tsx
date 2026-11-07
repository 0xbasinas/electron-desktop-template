import { useEffect, useState } from 'react'
import FlaskConical from 'lucide-react/icons/flask-conical'
import RefreshCw from 'lucide-react/icons/refresh-cw'
import Zap from 'lucide-react/icons/zap'
import type { UpdateChannel } from '../../shared/ipc'
import logo from './assets/logo.png'
import { TitleBar } from '@renderer/components/TitleBar'
import { TitleBarButton } from '@renderer/components/TitleBarButton'
import { UpdateBanner } from '@renderer/components/UpdateBanner'
import { useUpdater } from '@renderer/hooks/useUpdater'

function App(): React.JSX.Element {
  const { electron, chrome, node } = window.electron.process.versions
  const updater = useUpdater()
  const [channel, setChannel] = useState<UpdateChannel>('latest')
  const [opened, setOpened] = useState<string>()

  useEffect(() => {
    void window.api.getSettings().then((s) => setChannel(s.updateChannel))
    const offMenu = window.api.onMenuCheckUpdates(updater.check)
    const offLink = window.api.onDeepLink((url) => setOpened(`Deep link: ${url}`))
    const offFile = window.api.onOpenFile((path) => setOpened(`Opened file: ${path}`))
    return () => {
      offMenu()
      offLink()
      offFile()
    }
  }, [updater.check])

  const toggleChannel = async (): Promise<void> => {
    const next: UpdateChannel = channel === 'beta' ? 'latest' : 'beta'
    const settings = await window.api.setUpdateChannel(next)
    setChannel(settings.updateChannel)
  }

  return (
    <>
      <TitleBar>
        <TitleBarButton
          label="Send IPC ping"
          onClick={() => window.electron.ipcRenderer.send('ping')}
        >
          <Zap />
        </TitleBarButton>
        <TitleBarButton
          label={updater.checking ? 'Checking for updates...' : 'Check for updates'}
          disabled={updater.checking}
          onClick={updater.check}
        >
          <RefreshCw className={updater.checking ? 'animate-spin' : undefined} />
        </TitleBarButton>
        <TitleBarButton
          label={`Update channel: ${channel === 'beta' ? 'beta' : 'stable'} (click to switch)`}
          active={channel === 'beta'}
          onClick={toggleChannel}
        >
          <FlaskConical />
        </TitleBarButton>
      </TitleBar>
      <UpdateBanner updater={updater} />
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 pt-16">
        <img src={logo} alt="" className="size-20 rounded-2xl" />
        <h1 className="text-3xl font-semibold tracking-tight">Electron Desktop Template</h1>
        <p className="max-w-md text-center text-muted-foreground">
          Electron + Vite + React + TypeScript + Tailwind + shadcn/ui, with auto-updates and CI.
        </p>
        <p className="text-sm text-muted-foreground">
          Update channel: {channel === 'beta' ? 'beta' : 'stable'}
        </p>
        {opened && <p className="max-w-md break-all text-center text-sm">{opened}</p>}
        <p className="text-xs text-muted-foreground">
          Electron {electron} · Chromium {chrome} · Node {node}
        </p>
      </main>
    </>
  )
}

export default App
