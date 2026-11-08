import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { electron } from '@better-auth/electron'
import { passkey } from '@better-auth/passkey'
import * as Sentry from '@sentry/cloudflare'
import { betterAuth } from 'better-auth'
import { eq } from 'drizzle-orm'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { captcha, magicLink } from 'better-auth/plugins'
import { eventForCall, recordAudit } from './audit'
import type { Db } from './db'
import { schema } from './db'
import { BRAND } from './brand'
import { newDeviceEmail, recordSignIn } from './signIns'
import { magicLinkEmail, type EmailSender } from './email'
import { isSuppressed } from './suppression'
import type { Bindings } from './env'

/** Used when the variable APP_NAME is not set. */
export const DEFAULT_APP_NAME = 'Electron Desktop Template'

export interface AuthDeps {
  db: Db
  env: Bindings
  email: EmailSender
  /** Runs work after the response is sent (`ctx.waitUntil` on Workers). */
  waitUntil: (promise: Promise<unknown>) => void
}

/**
 * Better Auth, configured for Workers + D1. It is created per request because the D1 binding only exists
 * inside a request; creating it is cheap.
 *
 * Free-tier choices: no passwords (so no CPU-heavy hashing, which would not fit the 10 ms Workers Free
 * limit), a signed session cookie cache (so most requests do not read the database), and rate limiting
 * only on the sign-in endpoints (each counted request is a D1 write).
 */
export function createAuth({ db, env, email, waitUntil }: AuthDeps) {
  const extraOrigins = (env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  const appName = env.APP_NAME || DEFAULT_APP_NAME

  return betterAuth({
    appName,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL, ...extraOrigins],
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // The session is also kept in a signed cookie for 5 minutes, so most requests skip the database.
      cookieCache: { enabled: true, maxAge: 5 * 60 }
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 30,
      customRules: { '/get-session': false }
    },
    hooks: {
      // The security trail: failed sign-ins and account changes. After the response, and never fatal.
      after: createAuthMiddleware(async (ctx) => {
        const returned = ctx.context.returned
        const failed = returned instanceof APIError
        const event = eventForCall({
          path: ctx.path,
          failed,
          errorCode: failed ? (returned.body?.code as string | undefined) : undefined,
          location: ctx.context.responseHeaders?.get('location')
        })
        if (!event) return
        const userId = ctx.context.session?.user.id ?? null
        const actorId = ctx.path.startsWith('/admin/') ? userId : null
        const target = ctx.path.startsWith('/admin/')
          ? ((ctx.body as { userId?: string } | undefined)?.userId ?? null)
          : userId
        waitUntil(
          recordAudit(db, {
            ...event,
            userId: ctx.path.startsWith('/admin/') ? target : userId,
            actorId,
            ipAddress: ctx.headers?.get('cf-connecting-ip') ?? null,
            userAgent: ctx.headers?.get('user-agent') ?? null,
            now: Date.now()
          }).catch((error: unknown) => {
            console.error('Could not record the audit event', error)
            Sentry.captureException(error)
          })
        )
      })
    },
    databaseHooks: {
      session: {
        create: {
          // A new session is a sign-in: remember it for the activity list, and warn by email when it is from a
          // browser and system the account has not used before. After the response, and never fatal.
          after: async (created) => {
            waitUntil(
              (async () => {
                const now = Date.now()
                const ipAddress = created.ipAddress ?? null
                await recordAudit(db, {
                  type: 'user_signed_in',
                  outcome: 'success',
                  userId: created.userId,
                  ipAddress,
                  userAgent: created.userAgent ?? null,
                  now
                })
                const recorded = await recordSignIn(db, {
                  userId: created.userId,
                  ipAddress,
                  userAgent: created.userAgent ?? null,
                  now
                })
                if (!recorded.newDevice) return
                const [owner] = await db
                  .select({ email: schema.user.email })
                  .from(schema.user)
                  .where(eq(schema.user.id, created.userId))
                if (!owner || (await isSuppressed(db, owner.email))) return
                await email.send({
                  to: owner.email,
                  ...newDeviceEmail(appName, recorded.label, ipAddress, now)
                })
              })().catch((error: unknown) => {
                console.error('Could not record the sign-in', error)
                Sentry.captureException(error)
              })
            )
          }
        }
      }
    },
    advanced: {
      // Cloudflare sets this header on every request and overwrites any value the client sends.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      // Rate-limit bookkeeping and email sending happen after the response.
      backgroundTasks: { handler: waitUntil }
    },
    plugins: [
      // Bot check on the one endpoint that sends email. Only when both keys are set, so the site never asks for a
      // challenge it cannot show. The client sends the token in the `x-captcha-response` header.
      ...(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY
        ? [
            captcha({
              provider: 'cloudflare-turnstile',
              secretKey: env.TURNSTILE_SECRET_KEY,
              endpoints: ['/sign-in/magic-link']
            })
          ]
        : []),
      // Lets the desktop app sign in through the system browser (PKCE, then a one-time code over the deep link).
      electron(),
      // Sign in with a fingerprint, face or security key instead of waiting for an email. A passkey is tied to the
      // site's domain (rpID), so it cannot be used on a look-alike site. Passkeys are added from the account page.
      passkey({ rpID: new URL(env.BETTER_AUTH_URL).hostname, rpName: appName }),
      magicLink({
        expiresIn: 5 * 60,
        // Store only a hash of the token, so a leaked database cannot be used to sign in.
        storeToken: 'hashed',
        sendMagicLink: async ({ email: to, url }) => {
          // Not awaited: the response time must not reveal whether the address already has an account.
          waitUntil(
            (async () => {
              // An address that bounced or complained recently gets nothing (the answer to the person is the same).
              if (await isSuppressed(db, to)) {
                console.warn('Skipped a sign-in email to a suppressed address')
                return
              }
              await email.send({
                to,
                ...magicLinkEmail(url, appName, {
                  logoUrl: new URL('/email-logo.png', env.BETTER_AUTH_URL).href,
                  color: BRAND.color,
                  onColor: BRAND.onColor
                })
              })
            })().catch((error: unknown) => {
              console.error('Could not send the sign-in email', error)
              // The one failure that silently locks people out, so make sure someone hears about it.
              Sentry.captureException(error)
            })
          )
        }
      })
    ]
  })
}

export type Auth = ReturnType<typeof createAuth>
