---
name: release
description: Cut a Roastpilot release: pick the version, changelog, tag; GitHub Actions builds and publishes the macOS DMG and Windows installer. Use when the user asks to release or what the next version would be.
---

# Release

Releases are built by GitHub Actions from a tag, never on a laptop
([install-and-update.md](../../../docs/spec/install-and-update.md), ADR 0017).

1. Make sure `main` is green in CI and up to date.
2. Pick the version by the rules in
   [Version numbers](../../../docs/spec/install-and-update.md#version-numbers):
   - List every PR merged since the last tag (`git log --first-parent --oneline <last tag>..main`),
     each with its bump (minor / patch / none) and a one-line reason.
   - Propose the largest bump. Never pick a major yourself: if the release looks like one (a big
     refactor, data a previous version can't read, a milestone), say why and ask.
   - Show the list and the version and wait for the user's OK (AskUserQuestion) before step 3.
3. On a branch, update `CHANGELOG.md`: move the release's lines from `[Unreleased]` into
   `## [X.Y.Z] - YYYY-MM-DD` (Added / Changed / Fixed, written for the user, one line each). This
   section becomes the GitHub release notes, word for word.
4. Run `pnpm screenshots`; if `docs/images` changed, commit `docs: readme screenshots regenerated with pnpm screenshots` first.
   Bump `apps/desktop/package.json` `version` to `X.Y.Z`. Commit `chore(release): vX.Y.Z` and open
   a PR. Check locally: `node scripts/release-notes.ts --tag vX.Y.Z --out <scratch file>` passes.
5. After merge, tag the merge commit on `main` and push the tag:
   `git tag vX.Y.Z && git push origin vX.Y.Z`.
6. The `Release` workflow (`.github/workflows/release.yml`) runs:
   - **Verify:** fails if the tag doesn't match `apps/desktop/package.json` or `CHANGELOG.md` has
     no section for it; then `pnpm check`.
   - **Build:** a macOS runner (DMG + zip) and a Windows runner (NSIS installer) package the
     app and the update files (`latest-mac.yml`, `latest.yml`) as workflow artifacts. They have no
     write access.
   - **Publish:** the only job that can write: creates the GitHub release in one step, with the
     changelog section as the notes and every installer and update file attached.
   - If it fails before Publish, nothing is released: fix on a branch, delete the tag
     (`git push origin :refs/tags/vX.Y.Z`), merge, and tag again. Never re-use a published
     version: bump instead.
7. Smoke-test the downloaded installers, not local builds:
   - macOS: install the DMG on a clean user, first open (System Settings → Privacy & Security → Open Anyway; never "damaged"), Simulator roast,
     Settings › About shows the version. From 0.1.2 on, the previous version (in Applications)
     downloads the new one ("Downloading X.Y.Z"), and Restart to update swaps it and reopens the
     new version (refused mid-roast); About shows the new version and no "Couldn't update". Run
     from the DMG, the previous version shows "Version X.Y.Z is out · move Roastpilot to
     Applications…" with Download. Releases before 0.1.2 only show Download.
   - Windows: install, SmartScreen (More info → Run anyway), Simulator roast; the previous
     version downloads it and Restart to update installs it (refused mid-roast).
   - One real roast on the Skywalker.
8. No certificate yet: Windows builds are unsigned and macOS builds ad-hoc signed (`identity: '-'` in `electron-builder.yml`; `CSC_IDENTITY_AUTO_DISCOVERY=false`). The Build job checks the signature with `codesign --verify` and fails without one. When an Apple
   Developer ID or Windows certificate arrives, add it as repository secrets and update ADR 0017.
