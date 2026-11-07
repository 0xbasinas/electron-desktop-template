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

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`, with a lowercase subject, for example `feat(updater): add beta channel` or `fix: window opens off-screen`. Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `style`, `revert`. Add `!` (`feat!:`) or a `BREAKING CHANGE:` footer for breaking changes.

A git hook checks your message when you commit, and CI checks every commit in a pull request. The release notes are built from these messages.

## Releases

A push to `main` that changes the app (`src/`, `build/`, `package.json` and build config) publishes a release (`<major>.<minor>.<commit count>`) once CI passes, so only merge changes that are ready to ship. Docs, tests and CI changes don't release.

## Reporting bugs and ideas

Use the issue templates. For security problems, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
