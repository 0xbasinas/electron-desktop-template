# Monorepo and a web version: decision

**Decision: keep one package. Do not turn the template into a monorepo, and do not ship a web app by default.**
Revisit when one of the triggers below is true.

## Why not now

- **A template's job is to be easy to rename and read.** `pnpm rename`, the release workflows, the update test and
  the agent instructions all assume one app at the repo root. A monorepo multiplies each of those by the number of
  packages.
- **Packaging gets harder.** `electron-builder` has to find the app's production dependencies. In a pnpm workspace that
  usually means `node-linker=hoisted`, per-package `files` rules and extra care with symlinks, which is a common source of
  "works in dev, broken installer" bugs. Our dry run and update test would need reworking.
- **Release versioning is simple today:** one version, one tag, one set of installers. Several packages raise the
  question of what a "release" is.
- **The renderer is already portable.** The page only talks to Electron through `window.api` (the preload surface), and
  React, Tailwind and shadcn/ui run unchanged in a browser. Nothing in `src/renderer` needs Node. That is most of what a
  shared UI package would buy, without the cost.

## What keeps the door open (rules, already followed)

1. Renderer code never imports from `electron`, `node:*`, `src/main` or `src/preload`. It may import `src/shared` types.
2. Everything the renderer needs from the OS goes through `window.api`. A web build could provide a different
   implementation of the same `Api` type (HTTP, IndexedDB, nothing).
3. Features that only exist on desktop (tray, menu, updates, launch at login) are behind `window.api` calls, so the UI
   can hide them when they are not available.

## Triggers to revisit

- You want a **real web product** that shares UI with the desktop app. Then add `apps/web`, move `src/renderer` and the
  shared types into `packages/ui`, and put the `Api` type in `packages/shared`.
- A second **deployable** appears (a server, an admin site, a CLI) that shares code with the app.
- A shared **design system** is reused by other projects.

## If you do it later

- Use pnpm workspaces; add Turborepo only when builds get slow enough to need caching.
- Keep the Electron app in `apps/desktop` with its own `electron-builder.yml`, and keep the root workflows path-filtered so
  a web-only change does not publish a desktop release.
- Set `node-linker=hoisted` (or bundle dependencies) for the desktop app, then re-run the release dry run (`pnpm check:release`)
  and the update test on all three systems before trusting it.
- Add a thin `platform` layer in the renderer (`isDesktop`, `api`) instead of branching on `window.api` all over the UI.

## A cheap middle step

If you only want to **design or test the UI in a browser**, run the Vite renderer on its own with a fake `window.api`
(a small object implementing the `Api` type). That needs no monorepo and no new package, and also works for component
and screenshot tests.
