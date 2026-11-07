import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient } from './client'

const note = {
  id: '1',
  title: 't',
  body: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('createApiClient', () => {
  it('lists notes from /api/notes and validates them', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json([note]))
    const api = createApiClient({ baseUrl: 'https://x.test', fetch: fetchFn })
    expect(await api.notes.list()).toEqual([note])
    expect(fetchFn.mock.calls[0]![0]).toBe('https://x.test/api/notes')
    expect(fetchFn.mock.calls[0]![1].credentials).toBe('include')
  })

  it('rejects a response that does not match the schema', async () => {
    const api = createApiClient({ fetch: vi.fn().mockResolvedValue(json([{ id: 1 }])) })
    await expect(api.notes.list()).rejects.toThrow()
  })

  it('turns error responses into ApiError with the server message', async () => {
    const api = createApiClient({
      fetch: vi.fn().mockResolvedValue(json({ error: 'Sign in first' }, 401))
    })
    await expect(api.notes.list()).rejects.toMatchObject({ status: 401, message: 'Sign in first' })
    await expect(api.notes.list()).rejects.toBeInstanceOf(ApiError)
  })

  it('creates and deletes notes', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json(note, 201))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const api = createApiClient({ fetch: fetchFn })
    expect(await api.notes.create({ title: 't', body: '' })).toEqual(note)
    await api.notes.remove('a/b')
    expect(fetchFn.mock.calls[1]![0]).toBe('/api/notes/a%2Fb')
    expect(fetchFn.mock.calls[1]![1].method).toBe('DELETE')
  })
})
