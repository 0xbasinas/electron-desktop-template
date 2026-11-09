# Accounts, data and preferences

What a person can do with their account: send feedback, export or delete their data, and keep preferences in step across devices. Back to the [API overview](overview.md).

## Feedback

`POST /api/feedback` stores a message (kind `bug`, `idea` or `other`, up to 4000 characters, plus an optional diagnostics
report up to 24000) in the `feedback` table. It needs a session, so there is no anonymous spam, and each person can send
5 per hour (one indexed count; `FEEDBACK_PER_HOUR` in `packages/shared/src/feedback.ts`).

The web app has `/feedback`. The desktop app has a Settings section; its main process sends the message as the signed-in
person (`apps/desktop/src/main/feedback.ts`) and can attach the diagnostics report. Feedback is deleted with the account
(`ON DELETE CASCADE`) and listed in the data export, without the diagnostics text. Reading it is for the owner: query the
table with `wrangler d1 execute` until the admin dashboard exists.

## Account page, data export and deletion

`/account` on the site (signed-in only) lets a person sign out everywhere, download their data and delete their account.
The API behind it is `GET /api/account`, `GET /api/account/export` and `DELETE /api/account` (`apps/api/src/app.ts`).

- These routes ask the database for the session instead of trusting the 5-minute cookie cache, so a deleted account or a
  revoked session stops working at once.
- The export lists the account, the settings and the sign-ins (time, IP, browser) and never any token.
- Deleting needs the email typed again, and it is a request first: `DELETE /api/account` answers `202 { scheduledFor }` and the account stays for
  14 days (`DELETION_COOLING_OFF_DAYS` in `packages/shared/src/deletion.ts`). The person gets an email (sent with `waitUntil`) with a link to
  `/account/cancel-deletion?token=...`. Asking again keeps the first date and sends no second email. `GET /api/account` shows
  `deletionScheduledFor`, and `POST /api/account/deletion/cancel` (signed in) or `POST /api/account/deletion/cancel-with-token` (no sign-in) keeps the account.
- The emailed link opens a page with a button; the cancel is a POST, so an email scanner that only opens links cannot cancel by accident.
  Only a SHA-256 hash of the token is stored (`account_deletion`), and a token works once.
- A daily cron (`triggers.crons` in `apps/api/wrangler.jsonc`, handled by `scheduled` in `apps/api/src/index.ts`) calls `deleteDueAccounts`,
  which removes up to 50 due users per run. Sessions, linked accounts, passkeys, settings, feedback and device names go with the user
  (`ON DELETE CASCADE`) and unused sign-in links are removed. The cron needs no extra setup on Cloudflare's free plan.
- **When you add your own tables**, give them `userId ... references user.id ON DELETE CASCADE`, and add their rows to the export
  in `app.ts`, so deletion and export stay complete. The tests in `apps/api/test/api.test.ts` ("account") show how to check it.

## Synced preferences (the theme and accent colour follow you)

A small, useful example of data that follows a person between the web app and the desktop app: their **theme** (system, light
or dark) and **accent colour** (a fixed set of presets). Change them on `/account` or in the desktop **Settings > General** and the other catches up.

- API: `GET /api/preferences` and `PUT /api/preferences` (one row per person in the `preference` table). **Last write wins**:
  each save carries the time of the edit; the newest edit replaces the older one, and a stale device just gets the newer copy
  back. A stale write costs a read, not a D1 write. Times too far in the future are clamped, so a wrong clock cannot pin a value.
- Both apps keep the setting locally first (the website in `localStorage`, the desktop app in `settings.json` with a
  `preferencesUpdatedAt`, one time for both), so it applies instantly and works offline. Syncing is best effort: it runs at start, after signing in,
  when the theme changes, and every ten minutes in the desktop app (`apps/desktop/src/main/preferencesSync.ts`), and a failed
  attempt is retried by the next one because the local copy stays the newer one until it is sent.
- The logic that decides (`newerWins`, `reconcile`, `clampUpdatedAt`) is plain code in `packages/shared/src/preferences.ts`
  with tests.
- **To sync another preference**, add a field (with a default) to `preferencesSchema` in `packages/shared/src/preferences.ts`,
  read and write it in the website (`apps/web/src/lib/theme.ts` is the pattern) and, for the desktop app, add it as a setting
  (see "Adding a setting" in AGENTS.md) and include it in `preferencesSync.ts`.
