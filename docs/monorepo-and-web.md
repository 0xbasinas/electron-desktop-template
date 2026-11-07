# Monorepo, web app and API

**Decision:** one pnpm + Turborepo monorepo with a desktop app, a web app (marketing/download site plus the product at
`/app`), a small API, and shared packages. Web and API run on Cloudflare (Pages and Workers). Desktop and web release
independently.

## Layout

```
apps/desktop    Electron app (electron-vite + electron-builder). Released with the existing release system.
apps/web        Vite + React SPA: marketing/download site and the app at /app.   (step 3)
apps/api        Hono API on Cloudflare Workers: database and auth.               (step 4)
packages/ui      @repo/ui: shared components and the Tailwind theme (done).
packages/shared  Types and zod schemas shared by web, desktop and API (added with the API).
```

## Rules that keep it robust

- **One version per dependency.** Shared versions are in the `catalog:` of `pnpm-workspace.yaml`.
- **Packages are source-only and bundled by the app that uses them.** In `apps/desktop` a workspace package is a
  **devDependency**: Vite inlines it, and electron-builder packages only third-party `dependencies`. This avoids
  `node-linker=hoisted`, which breaks pnpm's strictness and electron-builder in subtle ways.
- **Boundaries.** Renderer/web code never imports `electron` or `node:*`. Anything OS-specific goes through `window.api`;
  the web build provides another implementation of the same `Api` type.
- **Independent releases.** Desktop publishes only when desktop code or shared packages change (path filters in
  `publish-*.yml`). Web and API deploy on their own from `main`.
- **Turborepo runs the graph** (`pnpm build`, `pnpm typecheck`, `pnpm test`). Lint, Prettier and commit hooks run once at the root.
- **Line endings are LF** (`.gitattributes`), so Windows and CI agree.

## Delivery plan

1. Workspace + Turborepo, desktop moved to `apps/desktop` (done).
2. Shared UI package `packages/ui` (done). `packages/shared` arrives with the API, when there is real shared code.
3. `apps/web`: marketing/download site and `/app`.
4. `apps/api`: Hono, database (Drizzle) and authentication, with a typed client used by web and desktop.
5. Deploy workflows for Cloudflare, final docs.
