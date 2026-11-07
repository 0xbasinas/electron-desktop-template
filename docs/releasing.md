# Releasing

Releases are automatic. You never create a tag or edit a version by hand.

| Workflow                 | File                 | When it runs                                                             |
| ------------------------ | -------------------- | ------------------------------------------------------------------------ |
| Publish stable release   | `publish-stable.yml` | Push to `main` that changes the app                                      |
| Publish beta pre-release | `publish-beta.yml`   | Push to `beta` that changes the app                                      |
| CI                       | `ci.yml`             | Pull requests, other pushes, and as a gate inside both publish workflows |

Both publish workflows run the same steps (`_publish.yml`): CI gate, version, build on Windows, macOS and Linux, attest, release notes and checksums.

**The CI gate.** Each publish workflow calls CI first and only publishes if it passes: lint, types, unit tests, bundle size, and a smoke test that launches the packaged app on all three operating systems.

**Path filter.** A push only publishes if it changes `src/` (not `*.test.ts(x)`), `build/`, `resources/`, `package.json`, `pnpm-lock.yaml`, `electron-builder.yml` or `electron.vite.config.ts`. Anything else (docs, tests, CI) is checked by CI but does not ship a build.

**Release notes.** `scripts/release-notes.mjs` groups the commits since the previous release by Conventional Commit type (Breaking changes, Features, Bug fixes, Performance, ...). Preview them locally with `pnpm release-notes v0.0.7 stable`.

## Channels

| Branch | Channel           | Release type   | Version example |
| ------ | ----------------- | -------------- | --------------- |
| `main` | stable (`latest`) | normal release | `0.0.12`        |
| `beta` | `beta`            | pre-release    | `0.0.15-beta`   |

- Version = `<major>.<minor>.<commit count>`. `major.minor` come from `package.json` (start: `0.0.0`),
  and the patch is the commit count of the pushed branch. Edit `package.json` to move to `0.1.x` or `1.0.x`.
- Pushing to `beta` publishes a GitHub pre-release. Pushing to `main` publishes a stable release.

To start a beta line, create the branch once and push work to it:

```bash
git push origin main:beta
```

Promote a beta by merging `beta` into `main`.

## What users get

Each install follows one channel, stored in its settings file (`updateChannel`) and switchable from the app
(the "Update channel" button in the demo UI).

- **Stable users** only ever see normal releases.
- **Beta users** see pre-releases too, and move to the next stable release once its version is higher.
  Switching a beta install back to stable does not downgrade it; it waits for the next stable build.

## Smaller updates

Every build ships `.blockmap` files, and `electron-updater` uses them for differential downloads, so users
only download the parts that changed. macOS ships both `.dmg` (first install) and `.zip` (what updates use).

## Verifying a download

Each release includes `SHA256SUMS.txt` and signed build-provenance attestations.

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
gh attestation verify <downloaded-file> --repo 0xbasinas/electron-desktop-template
```

The attestation proves the file was built by this repo's workflow from the tagged commit.

## Limits to know about

- macOS and Windows installers are not code-signed yet. macOS auto-update needs signing and notarization.
- The bundle size budget (`bundle-budget.json`) is checked in CI. Raise it on purpose, not by accident.
