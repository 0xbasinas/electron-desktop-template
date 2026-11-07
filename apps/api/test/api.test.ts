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

describe('desktop sign-in (system browser, PKCE)', () => {
  const b64url = (bytes: Uint8Array): string =>
    btoa(String.fromCharCode(...bytes))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')
  const linkIn = (text: string): string => /https?:\/\/\S+magic-link\/verify\S+/.exec(text)![0]

  it('hands the desktop app a one-time code that it can exchange for its own session', async () => {
    const s = setup()
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)))
    const challenge = b64url(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    )
    const state = 'stateABC123'
    const query = new URLSearchParams({ client_id: 'electron', code_challenge: challenge, state })

    // The sign-in page forwards the desktop parameters with the magic-link request.
    const request = await s.call(`/api/auth/sign-in/magic-link?${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'desk@example.com', callbackURL: '/auth/desktop' })
    })
    expect(request.status).toBe(200)
    const transfer = request.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
    expect(transfer).toContain('transfer_token')

    // The emailed link is opened in the same browser, so it carries the transfer cookie.
    const link = linkIn(s.sent[0]!.text)
    const verify = await s.call(new URL(link).pathname + new URL(link).search, {
      headers: { cookie: transfer }
    })
    expect(verify.status).toBe(302)
    const redirectCookie = verify.headers
      .getSetCookie()
      .map((c) => c.split(';')[0]!)
      .find((c) => c.startsWith('better-auth.electron='))
    expect(redirectCookie).toBeTruthy()
    const { identifier, state: returnedState } = JSON.parse(
      atob(decodeURIComponent(redirectCookie!.split('=')[1]!).replace(/-/g, '+').replace(/_/g, '/'))
    ) as { identifier: string; state: string }
    expect(returnedState).toBe(state)

    // The desktop app exchanges the code (with its secret verifier) for a session. Its origin is the app scheme.
    const exchange = await s.call('/api/auth/electron/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'electron-desktop-template:/' },
      body: JSON.stringify({ token: identifier, state, code_verifier: verifier })
    })
    expect(exchange.status).toBe(200)
    const body = (await exchange.json()) as { user: { email: string } }
    expect(body.user.email).toBe('desk@example.com')
    expect(exchange.headers.getSetCookie().join(';')).toContain('session_token')

    // The code works once.
    const again = await s.call('/api/auth/electron/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'electron-desktop-template:/' },
      body: JSON.stringify({ token: identifier, state, code_verifier: verifier })
    })
    expect(again.status).toBeGreaterThanOrEqual(400)
  })

  it('refuses a wrong code verifier', async () => {
    const s = setup()
    const challenge = b64url(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('right')))
    )
    const query = new URLSearchParams({
      client_id: 'electron',
      code_challenge: challenge,
      state: 'st'
    })
    const request = await s.call(`/api/auth/sign-in/magic-link?${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'pkce@example.com', callbackURL: '/auth/desktop' })
    })
    const transfer = request.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
    const link = linkIn(s.sent[0]!.text)
    const verify = await s.call(new URL(link).pathname + new URL(link).search, {
      headers: { cookie: transfer }
    })
    const cookie = verify.headers
      .getSetCookie()
      .map((c) => c.split(';')[0]!)
      .find((c) => c.startsWith('better-auth.electron='))!
    const { identifier } = JSON.parse(
      atob(decodeURIComponent(cookie.split('=')[1]!).replace(/-/g, '+').replace(/_/g, '/'))
    ) as { identifier: string }
    const exchange = await s.call('/api/auth/electron/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'electron-desktop-template:/' },
      body: JSON.stringify({ token: identifier, state: 'st', code_verifier: 'wrong' })
    })
    expect(exchange.status).toBe(400)
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

describe('account', () => {
  const json = (cookie: string, method: string, body?: unknown): RequestInit => ({
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })

  it('needs a session', async () => {
    const s = setup()
    expect((await s.call('/api/account')).status).toBe(401)
    expect((await s.call('/api/account/export')).status).toBe(401)
    expect(
      (await s.call('/api/account', json('', 'DELETE', { confirmEmail: 'x@example.com' }))).status
    ).toBe(401)
  })

  it('shows the account and exports everything held about it, without tokens', async () => {
    const s = setup()
    const cookie = await signIn(s, 'zed@example.com')
    await s.call('/api/notes', json(cookie, 'POST', { title: 'mine' }))

    const me = (await (await s.call('/api/account', { headers: { cookie } })).json()) as {
      email: string
    }
    expect(me.email).toBe('zed@example.com')

    const response = await s.call('/api/account/export', { headers: { cookie } })
    expect(response.headers.get('content-disposition')).toContain('attachment')
    const text = await response.text()
    const data = JSON.parse(text) as { notes: { title: string }[]; sessions: unknown[] }
    expect(data.notes.map((n) => n.title)).toEqual(['mine'])
    expect(data.sessions).toHaveLength(1)
    expect(text).not.toMatch(/token/i)
  })

  it("exports only the caller's own data", async () => {
    const s = setup()
    const a = await signIn(s, 'a1@example.com')
    const b = await signIn(s, 'b1@example.com')
    await s.call('/api/notes', json(a, 'POST', { title: 'a-only' }))
    const data = (await (
      await s.call('/api/account/export', { headers: { cookie: b } })
    ).json()) as {
      notes: unknown[]
    }
    expect(data.notes).toEqual([])
  })

  it('refuses to delete without the matching email', async () => {
    const s = setup()
    const cookie = await signIn(s, 'keep@example.com')
    const wrong = await s.call(
      '/api/account',
      json(cookie, 'DELETE', { confirmEmail: 'other@example.com' })
    )
    expect(wrong.status).toBe(400)
    expect((await s.call('/api/account', { headers: { cookie } })).status).toBe(200)
  })

  it('deletes the account, its notes and its sessions, and blocks cross-site requests', async () => {
    const s = setup()
    const cookie = await signIn(s, 'gone@example.com')
    await s.call('/api/notes', json(cookie, 'POST', { title: 'bye' }))
    await bindings.DB.prepare(
      "INSERT INTO passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up) VALUES ('pk1', 'laptop', 'k', (SELECT id FROM user WHERE email = ?), 'cred1', 0, 'singleDevice', 0)"
    )
      .bind('gone@example.com')
      .run()
    await s.call(
      '/api/preferences',
      json(cookie, 'PUT', { preferences: { theme: 'dark' }, updatedAt: 5 })
    )
    const userId = (await bindings.DB.prepare('SELECT id FROM user WHERE email = ?')
      .bind('gone@example.com')
      .first<{ id: string }>())!.id

    const cross = await s.call('/api/account', {
      ...json(cookie, 'DELETE', { confirmEmail: 'gone@example.com' }),
      headers: { cookie, 'content-type': 'application/json', origin: 'https://evil.example' }
    })
    expect(cross.status).toBe(403)

    const deleted = await s.call(
      '/api/account',
      json(cookie, 'DELETE', { confirmEmail: 'gone@example.com' })
    )
    expect(deleted.status).toBe(204)

    // The old cookie is dead at once (not after the 5-minute cache), and nothing is left in the database.
    expect((await s.call('/api/account', { headers: { cookie } })).status).toBe(401)
    const left = async (table: string, column: string): Promise<number | undefined> =>
      (
        await bindings.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`)
          .bind(userId)
          .first<{ n: number }>()
      )?.n
    expect(await left('user', 'id')).toBe(0)
    expect(await left('session', 'user_id')).toBe(0)
    expect(await left('note', 'user_id')).toBe(0)
    expect(await left('passkey', 'user_id')).toBe(0)
    expect(await left('preference', 'user_id')).toBe(0)
  })
})

describe('passkeys', () => {
  it('offers a challenge for the site domain to anyone, and keeps the list private', async () => {
    const s = setup()
    const options = await s.call('/api/auth/passkey/generate-authenticate-options')
    expect(options.status).toBe(200)
    const body = (await options.json()) as { challenge: string; rpId?: string }
    expect(body.challenge).toBeTruthy()
    expect(body.rpId).toBe(new URL(ORIGIN).hostname)

    expect((await s.call('/api/auth/passkey/list-user-passkeys')).status).toBe(401)
    const cookie = await signIn(s, 'pk@example.com')
    const list = await s.call('/api/auth/passkey/list-user-passkeys', { headers: { cookie } })
    expect(await list.json()).toEqual([])
  })

  it('needs a session to start adding a passkey', async () => {
    const s = setup()
    expect((await s.call('/api/auth/passkey/generate-register-options')).status).toBe(401)
    const cookie = await signIn(s, 'pk2@example.com')
    const ok = await s.call('/api/auth/passkey/generate-register-options', { headers: { cookie } })
    expect(ok.status).toBe(200)
  })
})

describe('preferences', () => {
  const put = (cookie: string, theme: string, updatedAt: number): RequestInit => ({
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ preferences: { theme }, updatedAt })
  })
  const get = async (s: ReturnType<typeof setup>, cookie: string): Promise<unknown> =>
    (await s.call('/api/preferences', { headers: { cookie } })).json()

  it('needs a session and blocks cross-site writes', async () => {
    const s = setup()
    expect((await s.call('/api/preferences')).status).toBe(401)
    const cookie = await signIn(s, 'pref0@example.com')
    const cross = await s.call('/api/preferences', {
      ...put(cookie, 'dark', 5),
      headers: { cookie, 'content-type': 'application/json', origin: 'https://evil.example' }
    })
    expect(cross.status).toBe(403)
  })

  it('starts with the defaults and keeps the newest edit', async () => {
    const s = setup()
    const cookie = await signIn(s, 'pref1@example.com')
    expect(await get(s, cookie)).toEqual({ preferences: { theme: 'system' }, updatedAt: 0 })

    const first = await s.call('/api/preferences', put(cookie, 'dark', 100))
    expect(await first.json()).toEqual({ preferences: { theme: 'dark' }, updatedAt: 100 })

    // An older edit from a device that was offline loses, and gets the newer copy back.
    const stale = await s.call('/api/preferences', put(cookie, 'light', 50))
    expect(await stale.json()).toEqual({ preferences: { theme: 'dark' }, updatedAt: 100 })
    expect(await get(s, cookie)).toEqual({ preferences: { theme: 'dark' }, updatedAt: 100 })

    const newer = await s.call('/api/preferences', put(cookie, 'light', 200))
    expect(await newer.json()).toEqual({ preferences: { theme: 'light' }, updatedAt: 200 })
  })

  it('rejects values it does not know', async () => {
    const s = setup()
    const cookie = await signIn(s, 'pref2@example.com')
    expect((await s.call('/api/preferences', put(cookie, 'pink', 5))).status).toBe(400)
    expect((await s.call('/api/preferences', put(cookie, 'dark', -5))).status).toBe(400)
  })

  it('cannot pin a time in the far future, and keeps people apart', async () => {
    const s = setup()
    const a = await signIn(s, 'pref3@example.com')
    const b = await signIn(s, 'pref4@example.com')
    const far = Date.now() + 10 * 365 * 86_400_000
    const saved = (await (await s.call('/api/preferences', put(a, 'dark', far))).json()) as {
      updatedAt: number
    }
    expect(saved.updatedAt).toBeLessThan(Date.now() + 10 * 60_000)
    expect(await get(s, b)).toEqual({ preferences: { theme: 'system' }, updatedAt: 0 })
  })
})
