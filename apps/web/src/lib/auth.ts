import { createAuthClient } from 'better-auth/react'
import { magicLinkClient } from 'better-auth/client/plugins'

/** Talks to /api/auth on this same origin, so the session cookie is first-party. */
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [magicLinkClient()]
})
