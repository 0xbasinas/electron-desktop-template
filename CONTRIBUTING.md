# Contributing

Thanks for helping out! This project uses **pnpm** and Node 24.

## Setup

```bash
pnpm install
pnpm dev
```

## Before opening a PR

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

CI runs the same checks. Please keep PRs focused, add or update tests for behavior changes, and describe what changed and why.

## Releases

Every push to `main` publishes a release (`<major>.<minor>.<commit count>`), so only merge changes that are ready to ship. Markdown-only changes don't release.

## Reporting bugs and ideas

Use the issue templates. For security problems, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
