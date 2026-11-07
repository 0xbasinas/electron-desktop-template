# Electron Desktop Template

Electron + Vite + React + TypeScript, with Tailwind CSS v4, shadcn/ui, auto-updates, tests and CI/release workflows. Uses **pnpm**.

## Scripts

| Command                                        | What it does                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`                                     | Run the app with HMR                                                              |
| `pnpm build`                                   | Typecheck and build                                                               |
| `pnpm build:win` / `build:mac` / `build:linux` | Package installers                                                                |
| `pnpm lint` / `pnpm format` / `pnpm typecheck` | Code quality                                                                      |
| `pnpm test`                                    | Vitest (jsdom)                                                                    |
| `pnpm icons`                                   | Regenerate app icons from `build/icon-source.svg`                                 |
| `pnpm check:bundle`                            | Fail if the renderer bundle exceeds `bundle-budget.json` (run after `pnpm build`) |
| `pnpm rename`                                  | Rename the template for a new app                                                 |

## Auto-update

`src/main/updater.ts` uses `electron-updater` against GitHub Releases (`publish` in `electron-builder.yml`). Only packaged builds check for updates.

- Every push to `main` publishes a stable release (`v0.0.7 (a1b2c3d)`); every push to `beta` publishes a pre-release on the beta channel. Users follow one channel, switchable in the app.
- The version is `<major>.<minor>.<commit count>`: `major.minor` come from `package.json`, so it grows on its own. Edit `package.json` to move to `0.1.x` or `1.0.x`. Markdown and `docs/` changes don't release.
- Updates are differential (blockmaps), and every release has `SHA256SUMS.txt` plus GitHub build-provenance attestations.
- The repo is public, so installed apps can read releases without a token. If you make it private again, add `private: true` to `publish` in `electron-builder.yml` and give installed apps a `GH_TOKEN`.
- macOS auto-update requires code signing and notarization (not configured here).

Details: [docs/releasing.md](docs/releasing.md). How the app is put together: [docs/architecture.md](docs/architecture.md).

## Icons and logo

Edit or replace `build/icon-source.svg` (square, ideally 1024x1024), then run `pnpm icons` to regenerate `build/icon.png`, `.ico`, `.icns` and `resources/icon.png`. The in-app logo is `src/renderer/src/assets/logo.png`.

## Deep links and file types

The app registers the `electron-desktop-template://` URL scheme and the `.tpl` file type (see `src/main/deeplink.ts` and `electron-builder.yml`). Change the extension in both places for your app.

## shadcn/ui

`components.json` is set up with the `@renderer` alias. Add components with `pnpm dlx shadcn@latest add <component>`.

## Using this template

Click **Use this template** on GitHub, clone your new repo, then rename everything in one go:

```bash
pnpm rename my-cool-app --owner your-github-user --title "My Cool App"
```

This updates `package.json`, `electron-builder.yml` (app id, product name, publish target), the app user model id, the deep-link scheme, the window title, the README title and the license holder. `--owner` and `--title` are optional. Review `git diff` afterwards.
