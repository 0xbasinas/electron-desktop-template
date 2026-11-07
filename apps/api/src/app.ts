import { zValidator } from '@hono/zod-validator'
import {
  deleteAccountInputSchema,
  noteInputSchema,
  type Account,
  type AccountExport,
  type Note
} from '@repo/shared'
import { and, desc, eq } from 'drizzle-orm'
import { Hono, type MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { createAuth, type Auth } from './auth'
import { createDb, schema, type Db } from './db'
import { createConsoleSender, createResendSender, type EmailSender } from './email'
import type { Bindings } from './env'
import { sameOriginOnly } from './origin'

type Variables = { auth: Auth; db: Db; userId: string }
type AppEnv = { Bindings: Bindings; Variables: Variables }

export interface AppOptions {
  /** Replace how emails are sent (tests). By default: Resend when a key is set, otherwise the log. */
  emailSender?: (env: Bindings) => EmailSender
}

const defaultEmailSender = (env: Bindings): EmailSender =>
  env.RESEND_API_KEY
    ? createResendSender(env.RESEND_API_KEY, env.EMAIL_FROM)
    : createConsoleSender()

const toNote = (row: typeof schema.note.$inferSelect): Note => ({
  id: row.id,
  title: row.title,
  body: row.body,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
})

/**
 * Requires a signed-in user. `fresh` skips the 5-minute session cookie cache and asks the database, which account
 * actions need: a deleted account or a revoked session must stop working at once, not five minutes later.
 */
const requireSession =
  (fresh: boolean): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const session = await c.var.auth.api.getSession({
      headers: c.req.raw.headers,
      query: fresh ? { disableCookieCache: true } : undefined
    })
    if (!session) throw new HTTPException(401, { message: 'Sign in first' })
    c.set('userId', session.user.id)
    await next()
  }

const toAccount = (row: typeof schema.user.$inferSelect): Account => ({
  id: row.id,
  email: row.email,
  name: row.name,
  createdAt: row.createdAt.toISOString()
})

export function createApp(options: AppOptions = {}) {
  const sender = options.emailSender ?? defaultEmailSender

  // Notes belong to the signed-in user. Every query below filters by userId.
  const notes = new Hono<AppEnv>()
    .use(sameOriginOnly)
    .use(requireSession(false))
    .get('/', async (c) => {
      const rows = await c.var.db
        .select()
        .from(schema.note)
        .where(eq(schema.note.userId, c.var.userId))
        .orderBy(desc(schema.note.createdAt))
        .limit(100)
      return c.json(rows.map(toNote))
    })
    .post('/', zValidator('json', noteInputSchema), async (c) => {
      const input = c.req.valid('json')
      const now = new Date()
      const row = {
        id: crypto.randomUUID(),
        userId: c.var.userId,
        ...input,
        createdAt: now,
        updatedAt: now
      }
      await c.var.db.insert(schema.note).values(row)
      return c.json(toNote(row), 201)
    })
    .delete('/:id', async (c) => {
      const deleted = await c.var.db
        .delete(schema.note)
        .where(and(eq(schema.note.id, c.req.param('id')), eq(schema.note.userId, c.var.userId)))
        .returning({ id: schema.note.id })
      if (deleted.length === 0) throw new HTTPException(404, { message: 'Not found' })
      return c.body(null, 204)
    })

  // The person's own account: see it, download everything we hold, delete it.
  const account = new Hono<AppEnv>()
    .use(sameOriginOnly)
    .use(requireSession(true))
    .get('/', async (c) => {
      const [row] = await c.var.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, c.var.userId))
      if (!row) throw new HTTPException(404, { message: 'Not found' })
      return c.json(toAccount(row))
    })
    .get('/export', async (c) => {
      const [row] = await c.var.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, c.var.userId))
      if (!row) throw new HTTPException(404, { message: 'Not found' })
      const noteRows = await c.var.db
        .select()
        .from(schema.note)
        .where(eq(schema.note.userId, c.var.userId))
        .orderBy(desc(schema.note.createdAt))
      // Only what the person can see on their account page; the public keys are not personal data.
      const passkeyRows = await c.var.db
        .select({
          name: schema.passkey.name,
          deviceType: schema.passkey.deviceType,
          createdAt: schema.passkey.createdAt
        })
        .from(schema.passkey)
        .where(eq(schema.passkey.userId, c.var.userId))
      // Session rows are listed without their tokens.
      const sessionRows = await c.var.db
        .select({
          createdAt: schema.session.createdAt,
          expiresAt: schema.session.expiresAt,
          ipAddress: schema.session.ipAddress,
          userAgent: schema.session.userAgent
        })
        .from(schema.session)
        .where(eq(schema.session.userId, c.var.userId))
      const body: AccountExport = {
        exportedAt: new Date().toISOString(),
        account: toAccount(row),
        notes: noteRows.map(toNote),
        passkeys: passkeyRows.map((p) => ({
          name: p.name,
          deviceType: p.deviceType,
          createdAt: p.createdAt?.toISOString() ?? null
        })),
        sessions: sessionRows.map((s) => ({
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          ipAddress: s.ipAddress,
          userAgent: s.userAgent
        }))
      }
      c.header('content-disposition', 'attachment; filename="my-data.json"')
      c.header('cache-control', 'no-store')
      return c.json(body)
    })
    .delete('/', zValidator('json', deleteAccountInputSchema), async (c) => {
      const { confirmEmail } = c.req.valid('json')
      const [row] = await c.var.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, c.var.userId))
      if (!row) throw new HTTPException(404, { message: 'Not found' })
      if (row.email.toLowerCase() !== confirmEmail) {
        throw new HTTPException(400, { message: 'The email does not match this account' })
      }
      // Sign out first so the response carries the headers that clear the session cookies.
      const signedOut = await c.var.auth.api.signOut({
        headers: c.req.raw.headers,
        asResponse: true
      })
      // Sessions, linked accounts and notes go with the user (ON DELETE CASCADE). Unused sign-in links are removed too.
      await c.var.db.batch([
        c.var.db.delete(schema.verification).where(eq(schema.verification.identifier, row.email)),
        c.var.db.delete(schema.user).where(eq(schema.user.id, c.var.userId))
      ])
      const response = c.body(null, 204)
      for (const cookie of signedOut.headers.getSetCookie())
        response.headers.append('set-cookie', cookie)
      return response
    })

  return (
    new Hono<AppEnv>()
      .basePath('/api')
      .use(secureHeaders())
      .use(async (c, next) => {
        const db = createDb(c.env.DB)
        c.set('db', db)
        c.set(
          'auth',
          createAuth({
            db,
            env: c.env,
            email: sender(c.env),
            waitUntil: (p) => c.executionCtx.waitUntil(p)
          })
        )
        await next()
      })
      .get('/health', (c) => c.json({ ok: true }))
      // Sign-in, sessions and sign-out: handled by Better Auth under /api/auth/*.
      .on(['GET', 'POST'], '/auth/*', (c) => c.var.auth.handler(c.req.raw))
      .route('/notes', notes)
      .route('/account', account)
      .onError((error, c) => {
        if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
        console.error('Unhandled error', error)
        return c.json({ error: 'Something went wrong' }, 500)
      })
      .notFound((c) => c.json({ error: 'Not found' }, 404))
  )
}

export type AppType = ReturnType<typeof createApp>
