import { zValidator } from '@hono/zod-validator'
import { noteInputSchema, type Note } from '@repo/shared'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
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

export function createApp(options: AppOptions = {}) {
  const sender = options.emailSender ?? defaultEmailSender

  // Notes belong to the signed-in user. Every query below filters by userId.
  const notes = new Hono<AppEnv>()
    .use(sameOriginOnly)
    .use(async (c, next) => {
      const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers })
      if (!session) throw new HTTPException(401, { message: 'Sign in first' })
      c.set('userId', session.user.id)
      await next()
    })
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
      .onError((error, c) => {
        if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
        console.error('Unhandled error', error)
        return c.json({ error: 'Something went wrong' }, 500)
      })
      .notFound((c) => c.json({ error: 'Not found' }, 404))
  )
}

export type AppType = ReturnType<typeof createApp>
