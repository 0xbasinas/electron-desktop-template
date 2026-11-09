# Sign-in and devices

How people sign in to the website and the desktop app, and how their devices are listed and removed. Back to the [API overview](overview.md).

## Web sign-in

`apps/web` has a `/sign-in` page (email, then "check your email") and `/app`, which needs a session. `/app` is an
empty starting point for your product; call the API from it through the typed client in `packages/shared/src/client.ts`
(responses are checked with zod). To add your own data, add a table in `apps/api/src/db/schema.ts`, run `pnpm --filter @repo/api db:generate`, and filter every query by the signed-in user's id. In development you
can also run `pnpm --filter @repo/web dev`; Vite proxies `/api` to `wrangler dev` on port 8787.

## Desktop sign-in

The desktop app never shows a password or email form. **Settings → Account → Sign in** opens the system browser on
`<API>/sign-in` (with a PKCE challenge and a random `state`); after the magic link is opened the site sends the browser
back to `<scheme>:/auth/callback#token=<one-time code>`. The app swaps that code and its secret verifier for a session,
which is stored encrypted with the operating system's keychain (Electron `safeStorage`).

- Only the main process talks to the API (`apps/desktop/src/main/auth.ts`); the renderer gets `getAccount`, `signIn` and
  `signOut` through narrow `secureIpc` channels. We do not use `@better-auth/electron`'s `setupMain`, because it would
  replace this app's scheme registration, CSP, single-instance lock and IPC.
- The deep link is checked before use (`authLink.ts`): right scheme, right path, code of the expected characters and length.
- The Account section only shows in builds that know the API address. Set `API_URL` (a repository **variable**, not a
  secret) to your deployed address for release builds; in development it defaults to `http://localhost:8787`.
- The Worker already trusts `<scheme>:/` as an origin (`TRUSTED_ORIGINS` in `wrangler.jsonc`); `pnpm rename` updates it.

## Devices

`GET /api/devices` lists the signed-in person's sessions, one per place they are signed in: a readable label worked out from the
user agent (`describeDevice` in `packages/shared/src/devices.ts`), an optional nickname, when it was created and last seen, and
which one is the caller's. `PATCH /api/devices/:id` sets or clears the nickname (up to 40 characters, stored in `session_nickname`,
which goes with the session or the account), and `DELETE /api/devices/:id` signs that device out. The id is the session's row id,
never its token, every query is limited to the caller's own sessions, and the caller's own session cannot be deleted this way
(sign out instead). These routes check the database on every call, so a device you signed out stops working at once; routes that
use the 5-minute session cookie cache (preferences, feedback) can take up to 5 minutes to notice.

The web app shows this on `/account` ("Your devices") and the desktop app in Settings. A nickname belongs to a session, so signing
in again on the same device starts without one. Nicknames are listed in the data export.

## Passkeys

Signing in with a passkey (fingerprint, face or security key) works next to the email link. People add passkeys on `/account`
and use them from `/sign-in`. It uses Better Auth's passkey plugin (`@better-auth/passkey`, SimpleWebAuthn underneath):

- A passkey is bound to the site's domain (`rpID` = the host of `BETTER_AUTH_URL`) and cannot be used on a look-alike site. If you
  change the domain, existing passkeys stop working, so decide it before people register.
- Verification uses the Web Crypto API, which is cheap enough for the free Workers CPU limit; a passkey sign-in costs one D1 write
  (the challenge) instead of an email.
- The desktop app signs in through the browser, so a passkey works there too: sign in on the web first, then choose Sign in in
  the app and the site hands the session over.
- The tests cover the endpoints and the rules around them (sessions needed, rpId, deletion cascades); the browser prompt itself
  needs a real authenticator, so try adding a passkey by hand after deploying.
