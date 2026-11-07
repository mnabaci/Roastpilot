---
name: release
description: Cut a Roastpilot release: version bump, changelog, tag; GitHub Actions builds and publishes the macOS DMG and Windows installer. Use when the user asks to release.
---

# Release

Releases are built by GitHub Actions from a tag, never on a laptop
([install-and-update.md](../../../docs/spec/install-and-update.md), ADR 0017).

1. Make sure `main` is green in CI and up to date.
2. Pick the version (semver) from the conventional commits since the last tag.
3. On a branch, update `CHANGELOG.md`: move the release's lines from `[Unreleased]` into
   `## [X.Y.Z] - YYYY-MM-DD` (Added / Changed / Fixed, written for the user, one line each). This
   section becomes the GitHub release notes, word for word.
4. Bump `apps/desktop/package.json` `version` to `X.Y.Z`. Commit `chore(release): vX.Y.Z` and open
   a PR. Check locally: `node scripts/release-notes.ts --tag vX.Y.Z --out <scratch file>` passes.
5. After merge, tag the merge commit on `main` and push the tag:
   `git tag vX.Y.Z && git push origin vX.Y.Z`.
6. The `Release` workflow (`.github/workflows/release.yml`) runs:
   - **Verify:** fails if the tag doesn't match `apps/desktop/package.json` or `CHANGELOG.md` has
     no section for it; then `pnpm check`.
   - **Build:** a macOS runner (DMG + zip) and a Windows runner (NSIS installer), each uploading
     to a draft release with the update files (`latest-mac.yml`, `latest.yml`).
   - **Publish:** sets the changelog section as the notes and publishes the release.
   - If it fails, fix on a branch, delete the tag (`git push origin :refs/tags/vX.Y.Z`) and any
     draft release, merge, and tag again. Never re-use a published version: bump instead.
7. Smoke-test the downloaded installers, not local builds:
   - macOS: install the DMG on a clean user, first open (Control-click → Open), Simulator roast,
     Settings › About shows the version; the previous version shows "Version X.Y.Z is out".
   - Windows: install, SmartScreen (More info → Run anyway), Simulator roast; the previous
     version downloads it and Restart to update installs it (refused mid-roast).
   - One real roast on the Skywalker.
8. No signing yet: builds are unsigned (`CSC_IDENTITY_AUTO_DISCOVERY=false`). When an Apple
   Developer ID or Windows certificate arrives, add it as repository secrets and update ADR 0017.
