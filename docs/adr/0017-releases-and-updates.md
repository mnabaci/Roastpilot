# 0017: GitHub releases and electron-updater, macOS unsigned for now

Status: accepted
Date: 2026-11-07

## Context

Roastpilot needs installers for macOS and Windows and a way to stay current without disrupting a roast. There is no Apple Developer ID (99 USD a year) or Windows code-signing certificate yet. macOS's Squirrel updater refuses unsigned apps, so a Mac build can't update itself. The repo is going public on GitHub.

## Decision

- **Builds:** electron-builder on GitHub Actions, on `vX.Y.Z` tags only: DMG + zip on a macOS runner, NSIS on a Windows runner, published as a GitHub release with `latest.yml`/`latest-mac.yml`.
- **Updates:** `electron-updater` with the GitHub provider, one code path for both platforms. Windows: `autoDownload` and install on quit or Restart to update. macOS: `autoDownload` off; a found update only shows "Version X is out · Download", which opens the release page.
- **Never during a roast:** the app's own `UpdateService` decides when Restart to update is allowed; the updater never restarts on its own.
- **Database backup** (`VACUUM INTO`) before any migration, so an update can always be rolled back by hand.

## Consequences

- Adds a runtime dependency (`electron-updater`) and a release workflow with write access, on tags only.
- Mac updates are a manual download until signing; adding the certificate later turns on background updates with config only.
- Unsigned builds ask once on first open (Gatekeeper, SmartScreen); the README explains it.
- Releases are tied to GitHub; moving elsewhere means a new updater provider.
