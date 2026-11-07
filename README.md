# Electron Desktop Template

[![CI](https://github.com/0xbasinas/electron-desktop-template/actions/workflows/ci.yml/badge.svg)](https://github.com/0xbasinas/electron-desktop-template/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/0xbasinas/electron-desktop-template)](https://github.com/0xbasinas/electron-desktop-template/releases/latest)
[![CodeQL](https://github.com/0xbasinas/electron-desktop-template/actions/workflows/codeql.yml/badge.svg)](https://github.com/0xbasinas/electron-desktop-template/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/0xbasinas/electron-desktop-template/badge)](https://scorecard.dev/viewer/?uri=github.com/0xbasinas/electron-desktop-template)
[![License: MIT](https://img.shields.io/github/license/0xbasinas/electron-desktop-template)](LICENSE)

Electron + Vite + React + TypeScript, with Tailwind CSS v4, shadcn/ui, auto-updates, tests and CI/release workflows. Uses **pnpm**.

## Scripts

| Command                                        | What it does                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm dev`                                     | Run the app with HMR                                                                      |
| `pnpm build`                                   | Typecheck and build                                                                       |
| `pnpm build:win` / `build:mac` / `build:linux` | Package installers                                                                        |
| `pnpm lint` / `pnpm format` / `pnpm typecheck` | Code quality                                                                              |
| `pnpm test:e2e`                                | Playwright smoke test against the packaged app (run `pnpm build:unpack` first)            |
| `pnpm test`                                    | Vitest (jsdom)                                                                            |
| `pnpm check:release`                           | After `pnpm build:<os> --publish never`: check the installers against the update manifest |
| `pnpm check:fuses`                             | Check the Electron fuses of the packaged app (`--test-build` for the Playwright build)    |
| `pnpm test:update`                             | Build 0.0.1 and 0.0.2, check the old one updates to the new one                           |
| `pnpm icons`                                   | Regenerate app icons from `build/icon-source.svg`                                         |
| `pnpm check:bundle`                            | Fail if the renderer bundle exceeds `bundle-budget.json` (run after `pnpm build`)         |
| `pnpm rename`                                  | Rename the template for a new app                                                         |

## Auto-update

`src/main/updater.ts` uses `electron-updater` against GitHub Releases (`publish` in `electron-builder.yml`). Only packaged builds check for updates.

- **Publish stable release** (`publish-stable.yml`): a push to `main` that changes the app runs CI, then builds Windows, macOS and Linux and publishes `v0.0.7 (a1b2c3d)`.
- **Publish beta pre-release** (`publish-beta.yml`): the same for the `beta` branch, published as a pre-release for people on the beta channel. Users switch channels in the app.
- Only changes to `src/` (not tests), `build/`, `resources/`, `package.json`, the lockfile and the build config publish. CI, docs and test changes don't. A failing CI blocks the publish.
- The version is `<major>.<minor>.<commit count>`: `major.minor` come from `package.json`, so it grows on its own. Edit `package.json` to move to `0.1.x` or `1.0.x`.
- New stable releases go to 10% of users first, then 25%, 50% and 100% over three days while the rollout guard sees healthy crash data. Pause, raise or roll back by hand from the Actions tab (see [docs/releasing.md](docs/releasing.md)).
- Every pull request builds the real installers on all three systems and checks them against the update manifest, so packaging problems fail before the merge.
- Release notes are generated from Conventional Commit messages (`feat:`, `fix:`, ...), grouped by type.
- Updates are differential (blockmaps), and every release has `SHA256SUMS.txt` plus GitHub build-provenance attestations.
- The repo is public, so installed apps can read releases without a token. If you make it private again, add `private: true` to `publish` in `electron-builder.yml` and give installed apps a `GH_TOKEN`.
- macOS auto-update requires code signing and notarization (not configured here).

Details: [docs/releasing.md](docs/releasing.md). How the app is put together: [docs/architecture.md](docs/architecture.md). Why this is one package and not a monorepo with a web app: [docs/monorepo-and-web.md](docs/monorepo-and-web.md).

## Security, settings and logs

Renderers are sandboxed, Electron fuses and ASAR integrity are on in releases (the app refuses to start if its code was tampered with), IPC calls are checked for who sent them and what they contain, and logs go to a file (Help > Show Log File). A Settings window (`Ctrl/Cmd+,`) holds the update channel, tray and launch-at-login options. After an update the app shows the release notes once, and a welcome screen on first run. Dependabot keeps dependencies current.

## Menu, tray and shortcuts

A native application menu, a system tray icon (click to show or hide) and a global shortcut, `Ctrl/Cmd+Shift+Space`, to show or hide the window from anywhere. The tray menu can keep the app running when you close the window (off by default). See [docs/architecture.md](docs/architecture.md).

## Icons and logo

Edit or replace `build/icon-source.svg` (square, ideally 1024x1024), then run `pnpm icons` to regenerate `build/icon.png`, `.ico`, `.icns` and `resources/icon.png`. The in-app logo is `src/renderer/src/assets/logo.png`.

## Deep links and file types

The app registers the `electron-desktop-template://` URL scheme and the `.tpl` file type (see `src/main/deeplink.ts` and `electron-builder.yml`). Change the extension in both places for your app.

## shadcn/ui

`components.json` is set up with the `@renderer` alias. Add components with `pnpm dlx shadcn@latest add <component>`.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(ui): add banner`, `fix: crash on start`). A git hook (husky + commitlint) checks them locally and CI checks pull requests. This is what drives the grouped release notes.

## Working with AI agents

[AGENTS.md](AGENTS.md) tells coding agents the commands, the pull-request rules (`main` is protected, PR titles are Conventional Commits, auto-merge), where code lives, the security rules for IPC, and the gotchas we hit. `CLAUDE.md` and `.github/copilot-instructions.md` point to it.

## Using this template

Click **Use this template** on GitHub, clone your new repo, then rename everything in one go:

```bash
pnpm rename my-cool-app --owner your-github-user --title "My Cool App"
```

This updates `package.json`, `electron-builder.yml` (app id, product name, publish target), the app user model id, the deep-link scheme, the window title, the README title and the license holder. `--owner` and `--title` are optional. Review `git diff` afterwards.
