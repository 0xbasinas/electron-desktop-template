import './assets/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SettingsWindow } from './components/SettingsWindow'

// Follow the OS light/dark setting (Electron maps it to prefers-color-scheme).
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = (): void => {
  document.documentElement.classList.toggle('dark', darkQuery.matches)
}
applyTheme()
darkQuery.addEventListener('change', applyTheme)

// One bundle, two windows: the settings window loads index.html#settings.
const isSettingsWindow = window.location.hash === '#settings'
if (isSettingsWindow) document.title = 'Settings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isSettingsWindow ? <SettingsWindow /> : <App />}</StrictMode>
)
