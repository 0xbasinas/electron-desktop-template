import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

const at = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('routes', () => {
  it('shows the home page', () => {
    at('/')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    const downloads = screen.getAllByRole('link', { name: 'Download' })
    expect(downloads.every((l) => l.getAttribute('href') === '/download')).toBe(true)
  })

  it('shows the web app under /app, including nested paths', () => {
    at('/app/anything/here')
    expect(screen.getByRole('heading', { name: 'Web app' })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes', () => {
    at('/nope')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('offers installers from the latest release', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: 'v1.0.0',
          html_url: 'https://github.com/o/r/releases/tag/v1.0.0',
          assets: [
            { name: 'app-setup.exe', browser_download_url: 'https://x/app-setup.exe', size: 1 }
          ]
        })
      })
    )
    at('/download')
    expect(await screen.findByText('Latest version: v1.0.0')).toBeInTheDocument()
    expect(screen.getAllByText('Not available yet')).toHaveLength(2)
    const installers = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href')?.endsWith('.exe'))
    expect(installers).toHaveLength(1)
  })

  it('falls back to GitHub when the lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    at('/download')
    expect(await screen.findByText(/Could not load the latest version/)).toBeInTheDocument()
  })
})
