import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import type { Bindings } from '../src/env'
import type { EmailMessage } from '../src/email'

const bindings = env as unknown as Bindings
const ORIGIN = bindings.BETTER_AUTH_URL

let nextIp = 1

/** An app whose emails are collected instead of sent. Each setup() is a different client IP, so rate limits do not leak between tests. */
function setup() {
  const ip = `10.0.${Math.floor(nextIp / 250)}.${nextIp++ % 250}`
  const sent: EmailMessage[] = []
  const app = createApp({ emailSender: () => ({ send: async (m) => void sent.push(m) }) })
  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    headers.set('cf-connecting-ip', ip)
    if (init.method && init.method !== 'GET' && !headers.has('origin'))
      headers.set('origin', ORIGIN)
    const ctx = createExecutionContext()
    const response = await app.fetch(
      new Request(`${ORIGIN}${path}`, { ...init, headers, redirect: 'manual' }),
      bindings,
      ctx
    )
    await waitOnExecutionContext(ctx)
    return response
  }
  return { sent, call }
}

/** Runs the whole magic-link flow and returns the session cookie. */
async function signIn(s: ReturnType<typeof setup>, email: string): Promise<string> {
  const before = s.sent.length
  const request = await s.call('/api/auth/sign-in/magic-link', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, callbackURL: '/app' })
  })
  expect(request.status).toBe(200)
  expect(s.sent.length).toBe(before + 1)
  const message = s.sent[before]!
  expect(message.to).toBe(email)
  const link = /https?:\/\/\S+magic-link\/verify\S+/.exec(message.text)?.[0]
  expect(link).toBeTruthy()

  const verify = await s.call(new URL(link!).pathname + new URL(link!).search)
  expect(verify.status).toBe(302)
  expect(verify.headers.get('location')).toContain('/app')
  const cookies = verify.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  expect(cookies).toContain('session_token')
  return cookies
}

describe('api', () => {
  it('answers the health check and unknown routes', async () => {
    const s = setup()
    expect(await (await s.call('/api/health')).json()).toEqual({ ok: true })
    const missing = await s.call('/api/nope')
    expect(missing.status).toBe(404)
  })

  it('sets security headers', async () => {
    const response = await setup().call('/api/health')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('refuses notes without a session', async () => {
    const s = setup()
    expect((await s.call('/api/notes')).status).toBe(401)
    const post = await s.call('/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'x' })
    })
    expect(post.status).toBe(401)
  })
})

describe('sign-in with a magic link', () => {
  it('signs a new user in and gives them a session', async () => {
    const s = setup()
    const cookie = await signIn(s, 'ada@example.com')
    const session = await s.call('/api/auth/get-session', { headers: { cookie } })
    const body = (await session.json()) as { user: { email: string } }
    expect(body.user.email).toBe('ada@example.com')
  })

  it('cannot use the same link twice', async () => {
    const s = setup()
    await s.call('/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'once@example.com', callbackURL: '/app' })
    })
    const link = /https?:\/\/\S+magic-link\/verify\S+/.exec(s.sent[0]!.text)![0]
    const path = new URL(link).pathname + new URL(link).search
    expect((await s.call(path)).status).toBe(302)
    const second = await s.call(path)
    expect(second.headers.get('location') ?? '').toMatch(/error/i)
    expect(second.headers.getSetCookie().join(';')).not.toContain('session_token')
  })

  it('rejects a malformed email', async () => {
    const s = setup()
    const response = await s.call('/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' })
    })
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(s.sent).toHaveLength(0)
  })

  it('rejects sign-in requests from another origin', async () => {
    const s = setup()
    const response = await s.call('/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ email: 'x@example.com' })
    })
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(s.sent).toHaveLength(0)
  })
})

describe('rate limiting', () => {
  it('slows down repeated sign-in requests from one address', async () => {
    const s = setup()
    const attempt = (): Promise<Response> =>
      s.call('/api/auth/sign-in/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'spam@example.com', callbackURL: '/app' })
      })
    const statuses: number[] = []
    for (let i = 0; i < 8; i++) statuses.push((await attempt()).status)
    expect(statuses).toContain(429)
    expect(s.sent.length).toBeLessThan(8)
  })
})

describe('notes', () => {
  const json = (cookie: string, method: string, body?: unknown): RequestInit => ({
    method,
    headers: { cookie, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })

  it('creates, lists and deletes a note', async () => {
    const s = setup()
    const cookie = await signIn(s, 'notes@example.com')

    const created = await s.call('/api/notes', json(cookie, 'POST', { title: '  Buy milk ' }))
    expect(created.status).toBe(201)
    const note = (await created.json()) as { id: string; title: string }
    expect(note.title).toBe('Buy milk')

    const list = (await (await s.call('/api/notes', { headers: { cookie } })).json()) as {
      id: string
    }[]
    expect(list.map((n) => n.id)).toEqual([note.id])

    expect((await s.call(`/api/notes/${note.id}`, json(cookie, 'DELETE'))).status).toBe(204)
    expect(await (await s.call('/api/notes', { headers: { cookie } })).json()).toEqual([])
  })

  it('validates input', async () => {
    const s = setup()
    const cookie = await signIn(s, 'valid@example.com')
    const response = await s.call('/api/notes', json(cookie, 'POST', { title: '' }))
    expect(response.status).toBe(400)
  })

  it("never shows or deletes another user's notes", async () => {
    const s = setup()
    const alice = await signIn(s, 'alice@example.com')
    const bob = await signIn(s, 'bob@example.com')

    const created = await s.call('/api/notes', json(alice, 'POST', { title: 'private' }))
    const { id } = (await created.json()) as { id: string }

    expect(await (await s.call('/api/notes', { headers: { cookie: bob } })).json()).toEqual([])
    expect((await s.call(`/api/notes/${id}`, json(bob, 'DELETE'))).status).toBe(404)
    expect(
      ((await (await s.call('/api/notes', { headers: { cookie: alice } })).json()) as unknown[])
        .length
    ).toBe(1)
  })

  it('blocks cross-site writes (CSRF)', async () => {
    const s = setup()
    const cookie = await signIn(s, 'csrf@example.com')
    const response = await s.call('/api/notes', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ title: 'x' })
    })
    expect(response.status).toBe(403)
  })
})
