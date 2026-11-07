# Electron Desktop Template

Electron + Vite + React + TypeScript, with Tailwind CSS v4, shadcn/ui, auto-updates, tests and CI/release workflows. Uses **pnpm**.

## Scripts

| Command                                        | What it does         |
| ---------------------------------------------- | -------------------- |
| `pnpm dev`                                     | Run the app with HMR |
| `pnpm build`                                   | Typecheck and build  |
| `pnpm build:win` / `build:mac` / `build:linux` | Package installers   |
| `pnpm lint` / `pnpm format` / `pnpm typecheck` | Code quality         |
| `pnpm test`                                    | Vitest (jsdom)       |

## Auto-update

`src/main/updater.ts` uses `electron-updater` against GitHub Releases (`publish` in `electron-builder.yml`). Only packaged builds check for updates.

- Every push to `main` runs `.github/workflows/release.yml`, which builds Windows, macOS and Linux and publishes a release named like `v0.0.7 (a1b2c3d)`.
- The version is `<major>.<minor>.<commit count>`: `major.minor` come from `package.json` (`0.0.0` to start), so the first commit is `0.0.1` and it grows on its own. Edit `package.json` to move to `0.1.x` or `1.0.x`. Markdown-only changes don't release.
- The repo is public, so installed apps can read releases without a token. If you make it private again, add `private: true` to `publish` in `electron-builder.yml` and give installed apps a `GH_TOKEN`.
- macOS auto-update requires code signing and notarization (not configured here).

## shadcn/ui

`components.json` is set up with the `@renderer` alias. Add components with `pnpm dlx shadcn@latest add <component>`.

## Rename checklist

Update `name` in `package.json`, `appId`/`productName`/`publish` in `electron-builder.yml`, and the app user model id in `src/main/index.ts`.
