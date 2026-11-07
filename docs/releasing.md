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
(Settings window, "Update channel").

- **Stable users** only ever see normal releases.
- **Beta users** see pre-releases too, and move to the next stable release once its version is higher.
  Switching a beta install back to stable does not downgrade it; it waits for the next stable build.

## Staged rollouts

A stable release is first offered to a share of users (`rollout` in `publish-stable.yml`, 10% by default).
This works through `stagingPercentage` in the update manifests (`latest*.yml`): each install has a stable
random number and only takes the update if that number falls inside the percentage.

1. Publish. About 10% of installs are offered the new version. Watch for crash reports and issues.
2. Looks good: run **Actions > Set release rollout** with the tag (for example `v0.1.42`) and a higher
   percentage, up to `100` for everyone. Raising it never takes the update away from anyone.
3. Looks bad: set it to `0` to stop offering it, then publish a fix. People who already have it keep it.

Beta releases are always offered to everyone on the beta channel. Set `rollout: 100` in `publish-stable.yml`
if you don't want staged rollouts. The logic lives in `scripts/lib/rollout.mjs` and is unit tested.

## What's new

The release notes (grouped from Conventional Commits) are written to `build/release-notes.md` during the
release build and shipped inside the app as `resources/release-notes.md`. After an update, the app shows them
once; on first launch it shows a short welcome instead. Users can reopen them from Help > What's New.

## Testing updates

`pnpm test:update` (also run in CI on Linux and Windows) builds version 0.0.1 and 0.0.2 of the real packaged
app with a local feed, starts the old one and checks that it finds, downloads and reports the new one, and
that a release staged at 0% is not offered. It catches broken packaging, a missing `app-update.yml` and
updater wiring mistakes. It stops after the download: installing and relaunching, and macOS (which needs a
signed build), are not covered.

## Dependency updates

Dependabot (`.github/dependabot.yml`) opens weekly PRs: one for Electron and its tooling, one for other minor and
patch updates, one for GitHub Actions. CI runs on every one, and the commit messages follow Conventional Commits.

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
