import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { electron } from '@better-auth/electron'
import { passkey } from '@better-auth/passkey'
import * as Sentry from '@sentry/cloudflare'
import { betterAuth } from 'better-auth'
import { magicLink } from 'better-auth/plugins'
import type { Db } from './db'
import { schema } from './db'
import { magicLinkEmail, type EmailSender } from './email'
import type { Bindings } from './env'

export const APP_NAME = 'Electron Desktop Template'

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

  return betterAuth({
    appName: APP_NAME,
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
    advanced: {
      // Cloudflare sets this header on every request and overwrites any value the client sends.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      // Rate-limit bookkeeping and email sending happen after the response.
      backgroundTasks: { handler: waitUntil }
    },
    plugins: [
      // Lets the desktop app sign in through the system browser (PKCE, then a one-time code over the deep link).
      electron(),
      // Sign in with a fingerprint, face or security key instead of waiting for an email. A passkey is tied to the
      // site's domain (rpID), so it cannot be used on a look-alike site. Passkeys are added from the account page.
      passkey({ rpID: new URL(env.BETTER_AUTH_URL).hostname, rpName: APP_NAME }),
      magicLink({
        expiresIn: 5 * 60,
        // Store only a hash of the token, so a leaked database cannot be used to sign in.
        storeToken: 'hashed',
        sendMagicLink: async ({ email: to, url }) => {
          // Not awaited: the response time must not reveal whether the address already has an account.
          waitUntil(
            email.send({ to, ...magicLinkEmail(url, APP_NAME) }).catch((error: unknown) => {
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
