import { lt } from 'drizzle-orm'
import type { Db } from './db'
import { schema } from './db'

/** Daily clean-up: access tokens, refresh tokens and client assertions that have run out are of no use to anyone. */
export async function pruneOauth(db: Db, now: number): Promise<void> {
  const at = new Date(now)
  await db.delete(schema.oauthAccessToken).where(lt(schema.oauthAccessToken.expiresAt, at))
  await db.delete(schema.oauthRefreshToken).where(lt(schema.oauthRefreshToken.expiresAt, at))
  await db.delete(schema.oauthClientAssertion).where(lt(schema.oauthClientAssertion.expiresAt, at))
}
