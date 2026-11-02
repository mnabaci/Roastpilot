---
name: release
description: Cut a Roastpilot release: version bump, changelog, signed macOS DMG and Windows installer. Use when the user asks to release.
---

# Release

1. Make sure `main` is green in CI and up to date.
2. Pick the version (semver) from the conventional commits since the last tag.
3. Update `CHANGELOG.md`: Added / Changed / Fixed, written for the user, one line each.
4. Bump `apps/desktop/package.json` version; commit `chore(release): vX.Y.Z` on a branch and open a PR.
5. After merge, tag `vX.Y.Z` on `main`.
6. Build: `pnpm --filter @roastpilot/desktop dist:mac` on macOS and `dist:win` on Windows. Signing (Apple Developer ID + notarisation; optional Windows code-signing certificate) uses credentials from the environment; never commit them.
7. Smoke-test each build with the simulator driver, then one real roast.
8. Attach the DMG and Windows installer to a GitHub release with the changelog section.
