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

- Pushing a tag like `v1.0.1` runs `.github/workflows/release.yml`, which builds Windows, macOS and Linux and publishes the release.
- This repo is private, so installed apps need a `GH_TOKEN` to read releases. For a public app, make the repo public and remove `private: true`.
- macOS auto-update requires code signing and notarization (not configured here).

## shadcn/ui

`components.json` is set up with the `@renderer` alias. Add components with `pnpm dlx shadcn@latest add <component>`.

## Rename checklist

Update `name` in `package.json`, `appId`/`productName`/`publish` in `electron-builder.yml`, and the app user model id in `src/main/index.ts`.
