---
name: release
description: Cut a Roastpilot release: version bump, changelog, signed macOS DMG. Use when the user asks to release.
---

# Release

1. Make sure `main` is green in CI and up to date.
2. Pick the version (semver) from the conventional commits since the last tag.
3. Update `CHANGELOG.md`: Added / Changed / Fixed, written for the user, one line each.
4. Bump `apps/desktop/package.json` version; commit `chore(release): vX.Y.Z` on a branch and open a PR.
5. After merge, tag `vX.Y.Z` on `main`.
6. Build: `pnpm --filter @roastpilot/desktop dist:mac`. Signing and notarisation need the Apple Developer ID certificate and credentials in the environment; never commit them.
7. Smoke-test the DMG on the Mac with the simulator driver, then one real roast.
8. Attach the DMG to a GitHub release with the changelog section.
