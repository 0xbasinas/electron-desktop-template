import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

// The auth client talks to the network; replace it with a controllable fake.
const auth = vi.hoisted(() => ({
  session: null as null | { user: { email: string } },
  pending: false,
  magicLink: vi.fn()
}))
vi.mock('./lib/auth', () => ({
  authClient: {
    useSession: () => ({ data: auth.session, isPending: auth.pending }),
    signIn: { magicLink: auth.magicLink },
    signOut: vi.fn()
  }
}))
const notesApi = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), remove: vi.fn() }))
vi.mock('./lib/api', () => ({ api: { notes: notesApi } }))

beforeEach(() => {
  auth.session = null
  auth.pending = false
  auth.magicLink.mockReset().mockResolvedValue({ data: {}, error: null })
  notesApi.list.mockReset().mockResolvedValue([])
  notesApi.create.mockReset()
  notesApi.remove.mockReset()
})

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

  it('sends signed-out visitors from /app (and nested paths) to the sign-in page', () => {
    at('/app/anything/here')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows the web app to a signed-in user', async () => {
    auth.session = { user: { email: 'ada@example.com' } }
    notesApi.list.mockResolvedValue([
      { id: '1', title: 'First note', body: '', createdAt: '', updatedAt: '' }
    ])
    at('/app')
    expect(screen.getByRole('heading', { name: 'Web app' })).toBeInTheDocument()
    expect(screen.getByText('Signed in as ada@example.com')).toBeInTheDocument()
    expect(await screen.findByText('First note')).toBeInTheDocument()
  })

  it('adds and deletes notes', async () => {
    auth.session = { user: { email: 'ada@example.com' } }
    notesApi.create.mockResolvedValue({
      id: '2',
      title: 'Milk',
      body: '',
      createdAt: '',
      updatedAt: ''
    })
    at('/app')
    await screen.findByText('No notes yet.')
    await userEvent.type(screen.getByLabelText('New note'), 'Milk')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(notesApi.create).toHaveBeenCalledWith({ title: 'Milk', body: '' })
    expect(await screen.findByText('Milk')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Milk' }))
    expect(notesApi.remove).toHaveBeenCalledWith('2')
    await waitFor(() => expect(screen.queryByText('Milk')).not.toBeInTheDocument())
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

describe('sign-in page', () => {
  it('asks for a link and tells the user to check their email', async () => {
    at('/sign-in')
    await userEvent.type(screen.getByLabelText('Email'), ' Ada@Example.com ')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))
    expect(auth.magicLink).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@example.com', callbackURL: '/app' })
    )
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
  })

  it('does not call the server for an invalid email', async () => {
    at('/sign-in')
    await userEvent.type(screen.getByLabelText('Email'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))
    expect(auth.magicLink).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('valid email')
  })

  it('explains a rate limit', async () => {
    auth.magicLink.mockResolvedValue({ data: null, error: { status: 429 } })
    at('/sign-in')
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries')
  })

  it('explains a link that did not work', () => {
    at('/sign-in?error=link')
    expect(screen.getByRole('alert')).toHaveTextContent('did not work')
  })

  it('skips the form when already signed in', () => {
    auth.session = { user: { email: 'ada@example.com' } }
    at('/sign-in')
    expect(screen.getByRole('heading', { name: 'Web app' })).toBeInTheDocument()
  })
})
