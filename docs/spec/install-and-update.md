# Install and update

How Roastpilot gets onto a computer and stays current, without ever touching a roast. Decision: [ADR 0017](../adr/0017-releases-and-updates.md).

## Releases

| Step                        | What happens                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Release PR                  | `chore(release): vX.Y.Z`: version in `apps/desktop/package.json`, the `CHANGELOG.md` section (`release` skill)              |
| Tag `vX.Y.Z` on `main`      | The `release` workflow runs `pnpm check`, then builds on a macOS runner (DMG + zip) and a Windows runner (NSIS installer)   |
| Publish                     | One GitHub release per tag with the installers, the update files (`latest.yml`, `latest-mac.yml`) and the changelog section |
| Tag and version don't match | The workflow fails before building                                                                                          |

- A PR that changes the release workflow, `electron-builder.yml`, the app's `package.json` or the lockfile builds both installers too, without publishing, so a broken build shows before a tag.
- Built by GitHub Actions only, never on a laptop, so every release comes from a tagged commit.
- The release token is `GITHUB_TOKEN` with `contents: write`, only in the release workflow's publish job, which checks out and installs nothing; the build jobs, which run install scripts, are read-only. The workflow runs on tags (never on fork PRs) and pins every action to a commit.
- No Apple Developer ID yet: the macOS app is ad-hoc signed (`identity: '-'`, no hardened runtime), because Apple silicon refuses an app with no signature at all as "damaged". macOS then asks once (System Settings → Privacy & Security → Open Anyway); Windows SmartScreen asks once (More info → Run anyway). The README says how.

## Updates

|                   | Windows                                                                  | macOS (ad-hoc signed)                                                             |
| ----------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Check             | At launch (after 10 s) and every 24 h, against the latest GitHub release | The same                                                                          |
| Found a newer one | Downloads it in the background (electron-updater)                        | Downloads the release's `.zip` in the background (Roastpilot's own Mac installer) |
| Ready             | Installs when you quit; or **Restart to update**                         | The same                                                                          |
| During a roast    | Never restarts; Restart to update is disabled ("Finish the roast first") | The same                                                                          |
| Can't install     | —                                                                        | **Download** opens the release page, as before (see Mac installer, Falls back)    |

- **During a roast** means Preheat to Cooling, or drum cooling. Quit still goes through the safe stop first ([safety.md](safety.md)); the installer runs after it. Restart to update runs the same shutdown (safe stop, save the roast, close the database, flush the logs) before it starts the installer, which closes the app; if the installer won't start, the app quits anyway rather than stay open shut down.
- **Only newer versions:** no downgrades, no pre-releases.
- **Offline or GitHub down:** the check fails quietly (logged, `update.check-failed`); About says "Couldn't check · try again", the next daily check tries again.
- **In development** (`pnpm dev`) the updater is off; About says "Updates are off in development".
- An Apple Developer ID later replaces the Mac installer with electron-updater's, as on Windows ([ADR 0018](../adr/0018-own-mac-installer.md)).

### Mac installer

macOS's own updater (Squirrel) accepts an update only when it is signed by the same Apple developer; an ad-hoc signature changes with every build, so Roastpilot installs Mac updates itself ([ADR 0018](../adr/0018-own-mac-installer.md)).

1. **Download:** the `.zip` that `latest-mac.yml` names, from the same GitHub release, into `<userData>/updates/`. About shows the percentage. A download cut off (offline, quit) is thrown away and tried again at the next check.
2. **Check, before it counts as ready:** size and SHA-512 match `latest-mac.yml`; unpacked with `ditto` (keeps the signature); the app inside passes `codesign --verify --deep --strict`, is `app.roastpilot.desktop`, and says the version that was found. Any mismatch: deleted, logged (`update.verify-failed`), About says "Couldn't update · try again".
3. **Ready:** "0.1.2 is ready · installs when you quit", **Restart to update**, the Settings tab dot, as on Windows.
4. **Install, after the app has quit:** the quit's last steps (after the safe stop, the roast save and closing the database) start a small helper (`mac-update-swap.sh`, shipped in the app's resources) and let it go. It waits up to 30 s for the app's process to end, then renames the installed app to `Roastpilot.app.old`, moves the new one into its place, deletes the old one and starts the new one (after Restart to update only). If a step fails it puts the old app back and logs why in `<userData>/updates/install.log`; the next launch reads it once and says "Couldn't update · try again" until the first check, 10 s later. That check doesn't download the same version again (it would fail the same way at every quit): it shows it as out, with **Download**. A newer version tries again. The same launch deletes anything a run left in `<userData>/updates/` (a download cut off by quitting, an app never installed).
5. **No prompt after the first install:** a file the app downloads itself carries no quarantine flag, so macOS doesn't ask again.

- **Falls back to Download** (the release page) when Roastpilot can't replace itself: running from the DMG, from a translocated copy (macOS runs apps opened from Downloads from a read-only copy), or from a folder you can't write to. About says why in one line ("Move Roastpilot to Applications to update by itself").
- **Trust:** HTTPS to GitHub plus the SHA-512 and signature checks catch a corrupted or altered download. They can't catch a bad release published from the repository itself; only a Developer ID signature would.

## What you see

- **Settings › About** (last section): Version `0.2.0`, then one row for updates, with one button:

| State                       | Line                                                                       | Button            |
| --------------------------- | -------------------------------------------------------------------------- | ----------------- |
| Not checked yet             | Not checked yet (the first 10 s)                                           | Check for updates |
| Up to date                  | Up to date · checked 14:02                                                 | Check for updates |
| Checking                    | Checking…                                                                  | (disabled)        |
| Downloading                 | Downloading 0.2.0 · 45 %                                                   | (none)            |
| Ready                       | 0.2.0 is ready · installs when you quit                                    | Restart to update |
| Out, can't install (macOS)  | Version 0.2.0 is out · move Roastpilot to Applications to update by itself | Download          |
| Out, install failed (macOS) | Version 0.2.0 is out · couldn't install it by itself                       | Download          |
| Couldn't check              | Couldn't check · try again                                                 | Check for updates |
| Couldn't update             | Couldn't update · try again (the download, its checks or the install)      | Check for updates |

- **Settings tab dot:** while an update is ready, or out and this copy can't install it (macOS, either case), the Settings tab carries a small ember dot, said to screen readers as "Update available". No pop-up, no toast.
- What's new: a "What's new" link next to the version opens the release notes on GitHub (not in development, where there is no release).
- A Restart to update or Download that fails, or is refused because a roast started meanwhile, says so in a toast; a failed check stays in the line.

## Your data across updates

- Settings, roasts, beans and profiles live in the app's user-data folder, which an update never touches.
- **Backup before migrations:** when a new version has database migrations to run, the app first copies the database to `backups/roastpilot-before-<new version>-<date>.db` in the user-data folder (SQLite `VACUUM INTO`, a clean copy; a second one the same day gets `-2`). The name says which update it came before: the database doesn't record which app version wrote it. A new, empty database needs no backup. The last 5 backups are kept; other files in the folder are left alone. If the backup fails, migrations don't run and History says why, as when the database can't open.
- An older app never opens a database a newer one migrated (it reports it as unreadable and leaves it alone).
