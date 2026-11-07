import { Rocket } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
  const { electron, chrome, node } = window.electron.process.versions

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <Rocket className="size-12" />
      <h1 className="text-3xl font-semibold tracking-tight">Electron Desktop Template</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Electron + Vite + React + TypeScript + Tailwind + shadcn/ui, with auto-updates and CI.
      </p>
      <div className="flex gap-2">
        <Button onClick={ipcHandle}>Send IPC ping</Button>
        <Button variant="outline" onClick={() => window.api.checkForUpdates()}>
          Check for updates
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Electron {electron} · Chromium {chrome} · Node {node}
      </p>
    </main>
  )
}

export default App
