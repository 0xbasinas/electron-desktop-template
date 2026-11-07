# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Copilot, Cursor, and similar) working in this repo.
Humans: see [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Keep this file short and true; if
you change how something works, change the matching line here.

## What this is

A template for Electron desktop apps: Electron + Vite (electron-vite) + React 19 + TypeScript, Tailwind v4 +
shadcn/ui, `electron-updater`, Vitest, Playwright, and GitHub Actions that test, package, sign off and publish releases.
Package manager is **pnpm** (never npm or yarn). Node 24.

## Commands

| Task                                | Command                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| Install                             | `pnpm install`                                                                     |
| Run in development                  | `pnpm dev`                                                                         |
| Format / lint / typecheck           | `pnpm format` / `pnpm lint` / `pnpm typecheck`                                     |
| Unit tests (src, scripts)           | `pnpm test`                                                                        |
| Build the app                       | `pnpm build` (typechecks first)                                                    |
| Bundle size budget                  | `pnpm check:bundle` (after `pnpm build`)                                           |
| Package unpacked app                | `pnpm build:unpack`                                                                |
| End-to-end tests (packaged app)     | `pnpm build:unpack && pnpm test:e2e`                                               |
| Update test (old build updates new) | `pnpm test:update` (builds installers; needs a working NSIS/AppImage toolchain)    |
| Check installers vs update manifest | `pnpm build:win` (or `:mac`, `:linux`) `--publish never` then `pnpm check:release` |

Before saying a change is done, run at least: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`. For
anything touching main, preload, the window or IPC, also `pnpm build:unpack && pnpm test:e2e`.

## Workflow rules (important)

- **`main` is protected and admins are included.** You cannot push to `main`. Work on a branch, push it, open a pull
  request, and turn on auto-merge: `gh pr merge --auto --squash`. Squash is the only merge method.
- **The PR title becomes the commit message** and must be a Conventional Commit: `feat: ...`, `fix(ui): ...`,
  `chore: ...`, `ci: ...`, `docs: ...`. A check enforces it. Release notes are built from these.
- Required checks must pass: lint/types/tests/bundle, smoke test (3 OSes), update test (Ubuntu, Windows), package dry
  run (3 OSes), dependency audit, CodeQL. Do not weaken, skip or delete a check to get green; fix the cause.
- Merging a change under `src/`, `build/`, `resources/`, `package.json`, the lockfile or the build config **publishes a
  release** (10% rollout at first). Docs, tests, scripts and CI-only changes do not. So only merge what is ready to ship.
- Commit trailers: end commits with the `Co-Authored-By` line your environment gives you. Never skip hooks.
- Do not commit generated folders: `dist/`, `dist-update/`, `out/`, `test-results/`.
- Dependabot opens grouped PRs; patch and minor ones merge themselves. Do not hand-edit `pnpm-lock.yaml`.

## Where things live

```
src/main/        Electron main process (Node). index.ts is the entry.
src/preload/     api.ts = everything the page may call (contextBridge). Sandboxed: import only `electron` + shared code.
src/renderer/    React app. main.tsx routes `#settings` to the Settings window, anything else to App.
src/shared/      ipc.ts (channels + types), validate.ts (payload checks). Imported by all three processes.
scripts/         Node scripts (release notes, rollout, manifest checks). scripts/lib/*.mjs are pure and unit tested.
tests/e2e/       Playwright against the packaged app.   tests/update/  old-to-new update test.
.github/         Workflows. publish-stable / publish-beta call _publish.yml after ci.yml passes.
docs/            architecture.md (how the app works), releasing.md (releases, rollouts, rollbacks),
                 monorepo-and-web.md (why one package, and when to change that).
```

## Rules for code

- **The renderer is untrusted.** Windows use `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`. Never
  loosen these, never expose `ipcRenderer` or Node APIs to the page.
- **Adding an IPC call** (also in docs/architecture.md): add the channel and types to `src/shared/ipc.ts`; handle it in
  main with `handle()` from `src/main/secureIpc.ts` (never raw `ipcMain.handle`) and validate every argument with a
  function in `src/shared/validate.ts` (with a test); expose one narrow function in `src/preload/api.ts`; call
  `window.api.thing()` from React.
- **Adding a setting:** add it to `Settings` in `ipc.ts`, `readStored`/`getSettings` in `settings.ts`, the
  allow-list in `validate.ts`, a test, the e2e `getSettings` expectation, and the Settings window.
- The packaged UI is served from `app://renderer/` (`src/main/appProtocol.ts`), not `file://`. Never load remote or `file://`
  content into a window, and keep `isTrustedUrl` strict.
- `src/preload` must not import third-party packages (a sandboxed preload can only `require('electron')`).
- Keep the renderer small: `bundle-budget.json` fails CI if JS/CSS grows past it. Raise it deliberately, not by accident.
- Prefer small pure functions with tests (see `scripts/lib/` and `src/shared/validate.ts`) over logic buried in workflows.
- Strings that show the app name come from `document.title`, `app.getName()` or `electron-builder.yml`; do not hard-code
  "Electron Desktop Template" in new code. `pnpm rename` replaces the known occurrences for new apps.
- TypeScript is strict. No `any` without a reason. Explicit return types on exported functions (ESLint enforces it).
- Style is Prettier (no semicolons, single quotes). Run `pnpm format`; do not fight it.

## Release system in one paragraph

Version is `<major.minor from package.json>.<git commit count>`; beta adds `-beta`. Merge to `main` runs CI, then
`_publish.yml` builds Windows/macOS/Linux, publishes to GitHub Releases at 10%, attests provenance, adds
`SHA256SUMS.txt` and embeds release notes in the app. `rollout-guard.yml` (hourly) pauses a crashing release at 0% and
otherwise promotes it 25% -> 50% -> 100% over three days. `rollback-release.yml` and `set-rollout.yml` are manual.
Details: [docs/releasing.md](docs/releasing.md).

## Gotchas learned the hard way

- On Windows, files may have CRLF line endings: normalise before regex or string replacement (`.replaceAll('\r\n','\n')`).
- Compare file paths with `path.resolve`, never with `startsWith` on a path built with `/`.
- `pnpm run script -c.x=y` mangles `-c` flags. Set the version with `npm pkg set version=...`, or write a temp config file.
- The Vite/Rolldown renderer is only minified because `electron.vite.config.ts` sets `minify: true`; keep it.
- `electron-vite` main/preload leave dependencies external, so main-process dependencies must be in `dependencies`.
- Releases switch Electron fuses and ASAR integrity on. Playwright needs `enableNodeCliInspectArguments`, so only test builds
  (`pnpm build:unpack`, the update test) turn it on. Never weaken `electronFuses` in `electron-builder.yml` for a release, and
  update `scripts/lib/fuses.mjs` when you change it. If a Playwright launch times out, suspect that fuse.
- macOS auto-update needs code signing, which is not set up; the update test therefore skips macOS.
- GitHub takes a minute to recompute mergeability after a push or a branch-protection change; "blocked" can be stale.
- `makensis` can fail to spawn on some local Node versions (`ENOTCONN`); CI is the reference for installer builds.
- Do not run long waits as foreground `sleep`; use the background-task or watch mechanisms your tool provides.

## Do not

- Push to `main`, force-push, or bypass branch protection.
- Add secrets, tokens or personal data to the repo, workflow logs or PR text. Crash reporting is opt-in and off without a DSN.
- Enable auto-merge on a PR that has failing checks, or merge major dependency updates (Electron especially) without testing.
- Add a dependency for something small. Check bundle size and `pnpm audit` first.
- Edit generated files by hand: `pnpm-lock.yaml`, `build/icon.*` (run `pnpm icons`), `out/`, `dist/`.
