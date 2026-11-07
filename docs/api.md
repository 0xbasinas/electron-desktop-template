# API, database and sign-in

`apps/api` is a [Hono](https://hono.dev) app on Cloudflare Workers. It uses D1 (SQLite) through Drizzle, and
[Better Auth](https://www.better-auth.com) for sign-in with **magic links** sent by [Resend](https://resend.com).
The same Worker also serves the built web app (`apps/web/dist`), so the site and the API share one origin: the session
cookie is first-party and there is no CORS to configure.

```
apps/api/src/index.ts      The Worker (default export) and the `AppType` used for the typed client
apps/api/src/app.ts        Routes: /api/health, /api/auth/* (Better Auth), /api/notes (example resource)
apps/api/src/auth.ts       Better Auth configuration (magic link, sessions, rate limits)
apps/api/src/email.ts      EmailSender: Resend in production, the log in development, a fake in tests
apps/api/src/origin.ts     Blocks cross-site writes
apps/api/src/db/           Drizzle schema (auth-schema.ts is generated) and the D1 client
apps/api/drizzle/          SQL migrations, applied to D1 by wrangler
apps/api/test/             Tests that run inside the real Workers runtime with a real D1
packages/shared/           zod schemas shared by API, web and desktop
```

## Run it locally

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars     # then edit the secret
pnpm --filter @repo/web build                        # the Worker serves apps/web/dist
pnpm --filter @repo/api db:migrate:local
pnpm --filter @repo/api dev                          # http://localhost:8787
```

Without `RESEND_API_KEY`, the sign-in link is printed in the terminal.

## Deploy

Run `pnpm setup:cloud` once. It creates the D1 database, verifies your sending domain in Resend, generates the secrets,
applies the migrations, deploys the Worker and sets the GitHub variables. Every step, the options and the manual
equivalents are in [setup-cloud.md](setup-cloud.md).

After that, `.github/workflows/deploy-web.yml` deploys on every merge to `main` that changes `apps/web`, `apps/api` or
`packages/` (it applies pending D1 migrations first, then deploys; it stays off until the repository variable
`CLOUDFLARE_DEPLOY` is `true`). The Worker's own secrets (`BETTER_AUTH_SECRET`, `RESEND_API_KEY`) live in Cloudflare and
CI never sees them. Migrations run before the new code, so write each one to work with the previous version too.

## Changing the database

Edit `src/db/schema.ts`, run `pnpm --filter @repo/api db:generate --name what-changed`, commit the new SQL file in
`apps/api/drizzle/`. If you add a Better Auth plugin that needs tables, add it to `src/auth.cli.ts` too and run
`pnpm --filter @repo/api auth:schema` to regenerate `auth-schema.ts`. Never edit applied migrations.

## Staying on the free tier

Cloudflare Workers Free allows 100,000 requests/day and 10 ms CPU per request; D1 Free allows 5 million rows read and
100,000 rows written per day (limits as published by Cloudflare when this was written; check them before relying on this).
The design keeps well inside that:

- **No passwords**: password hashing is CPU heavy and would not fit in 10 ms. Magic links need no hashing.
- **Session cookie cache** (5 minutes): most requests do not read the database.
- **Rate limits only on sign-in**: each counted request is a D1 write, so `/get-session` is not counted.
- **Static files are free**: only `/api/*` runs Worker code.
- Resend's free plan is 100 emails/day, 3,000/month, so sign-in emails are the real ceiling.

## Security notes

- Magic-link tokens are stored hashed, expire after 5 minutes and work once.
- Sign-in requests are rate limited per IP (`cf-connecting-ip`, which Cloudflare sets itself).
- Writes with a cross-site `Origin` are rejected (`src/origin.ts`); Better Auth checks origins on its own routes.
- Every notes query filters by the signed-in user. The tests check that one user cannot read or delete another's notes.
- The email sender is not awaited, so the response time does not reveal whether an address already has an account.

## Web sign-in

`apps/web` has a `/sign-in` page (email, then "check your email") and `/app`, which needs a session and shows the notes
example through the typed client in `packages/shared/src/client.ts` (responses are checked with zod). In development you
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

## Account page, data export and deletion

`/account` on the site (signed-in only) lets a person sign out everywhere, download their data and delete their account.
The API behind it is `GET /api/account`, `GET /api/account/export` and `DELETE /api/account` (`apps/api/src/app.ts`).

- These routes ask the database for the session instead of trusting the 5-minute cookie cache, so a deleted account or a
  revoked session stops working at once.
- The export lists the account, the notes and the sign-ins (time, IP, browser) and never any token.
- Deleting needs the email typed again. It removes the user; sessions, linked accounts and notes go with it (`ON DELETE CASCADE`),
  unused sign-in links are removed, and the response clears the session cookies.
- **When you add your own tables**, give them `userId ... references user.id ON DELETE CASCADE`, and add their rows to the export
  in `app.ts`, so deletion and export stay complete. The tests in `apps/api/test/api.test.ts` ("account") show how to check it.

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

## Synced preferences (the theme follows you)

A small, useful example of data that follows a person between the web app and the desktop app: their **theme** (system, light
or dark). Change it on `/account` or in the desktop **Settings > General** and the other catches up.

- API: `GET /api/preferences` and `PUT /api/preferences` (one row per person in the `preference` table). **Last write wins**:
  each save carries the time of the edit; the newest edit replaces the older one, and a stale device just gets the newer copy
  back. A stale write costs a read, not a D1 write. Times too far in the future are clamped, so a wrong clock cannot pin a value.
- Both apps keep the setting locally first (the website in `localStorage`, the desktop app in `settings.json` with a
  `themeUpdatedAt`), so it applies instantly and works offline. Syncing is best effort: it runs at start, after signing in,
  when the theme changes, and every ten minutes in the desktop app (`apps/desktop/src/main/preferencesSync.ts`), and a failed
  attempt is retried by the next one because the local copy stays the newer one until it is sent.
- The logic that decides (`newerWins`, `reconcile`, `clampUpdatedAt`) is plain code in `packages/shared/src/preferences.ts`
  with tests.
- **To sync another preference**, add a field (with a default) to `preferencesSchema` in `packages/shared/src/preferences.ts`,
  read and write it in the website (`apps/web/src/lib/theme.ts` is the pattern) and, for the desktop app, add it as a setting
  (see "Adding a setting" in AGENTS.md) and include it in `preferencesSync.ts`.

## Error reporting (Sentry, optional)

Set the secret `SENTRY_DSN` and unexpected errors in the Worker are reported to [Sentry](https://sentry.io) (free plan is enough to start),
including the one that silently locks people out: a sign-in email that could not be sent. Without it nothing is sent.

- Errors only: no traces, no user identity (`dataCollection.userInfo` is off). Expected failures (401, 403, 404, validation) are
  not reported, only 500s and failed emails.
- Turn it on: create a Sentry project (platform "Cloudflare Workers"), then `SENTRY_DSN=<dsn> pnpm setup:cloud --skip-resend`, or
  `wrangler secret put SENTRY_DSN`. Use Sentry's alert rules to get an email or chat message on a new issue.
- It adds about 250 KiB (gzip) to the Worker, which is far below the 3 MiB limit of the free plan.
- `GET /api/health` is a good URL for an uptime monitor (Cloudflare Health Checks, UptimeRobot, Better Stack).
