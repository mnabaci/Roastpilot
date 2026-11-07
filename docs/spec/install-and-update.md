# Install and update

How Roastpilot gets onto a computer and stays current, without ever touching a roast. Decision: [ADR 0017](../adr/0017-releases-and-updates.md).

## Releases

| Step                        | What happens                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Release PR                  | `chore(release): vX.Y.Z`: version in `apps/desktop/package.json`, the `CHANGELOG.md` section (`release` skill)              |
| Tag `vX.Y.Z` on `main`      | The `release` workflow runs `pnpm check`, then builds on a macOS runner (DMG + zip) and a Windows runner (NSIS installer)   |
| Publish                     | One GitHub release per tag with the installers, the update files (`latest.yml`, `latest-mac.yml`) and the changelog section |
| Tag and version don't match | The workflow fails before building                                                                                          |

- Built by GitHub Actions only, never on a laptop, so every release comes from a tagged commit.
- The release token is `GITHUB_TOKEN` with `contents: write`, only in the release workflow's publish job, which checks out and installs nothing; the build jobs, which run install scripts, are read-only. The workflow runs on tags (never on fork PRs) and pins every action to a commit.
- No signing yet: macOS asks once to open an app from an unidentified developer (Control-click → Open, or System Settings → Privacy & Security → Open Anyway); Windows SmartScreen asks once (More info → Run anyway). The README says how.

## Updates

|                   | Windows                                                                  | macOS (unsigned)                                             |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Check             | At launch (after 10 s) and every 24 h, against the latest GitHub release | The same                                                     |
| Found a newer one | Downloads it in the background                                           | Nothing downloads: macOS won't install an unsigned update    |
| Ready             | Installs when you quit; or **Restart to update**                         | **Download** opens the release page; you install the new DMG |
| During a roast    | Never restarts; Restart to update is disabled ("Finish the roast first") | —                                                            |

- **During a roast** means Preheat to Cooling, or drum cooling. Quit still goes through the safe stop first ([safety.md](safety.md)); the installer runs after it.
- **Only newer versions:** no downgrades, no pre-releases.
- **Offline or GitHub down:** the check fails quietly (logged, `update.check-failed`); About says "Couldn't check · try again", the next daily check tries again.
- **In development** (`pnpm dev`) the updater is off; About says "Updates are off in development".
- Signing later (Apple Developer ID) switches macOS to the Windows column; the app code doesn't change.

## What you see

- **Settings › About** (last section): Version `0.2.0`, then one row for updates, with one button:

| State                 | Line                                    | Button            |
| --------------------- | --------------------------------------- | ----------------- |
| Not checked yet       | Not checked yet (the first 10 s)        | Check for updates |
| Up to date            | Up to date · checked 14:02              | Check for updates |
| Checking              | Checking…                               | (disabled)        |
| Downloading (Windows) | Downloading 0.2.0 · 45 %                | (none)            |
| Ready (Windows)       | 0.2.0 is ready · installs when you quit | Restart to update |
| Out (macOS)           | Version 0.2.0 is out                    | Download          |
| Couldn't check        | Couldn't check · try again              | Check for updates |

- **Settings tab dot:** while an update is ready (Windows) or out (macOS), the Settings tab carries a small ember dot, said to screen readers as "Update available". No pop-up, no toast.
- What's new: a "What's new" link next to the version opens the release notes on GitHub (not in development, where there is no release).
- A Restart to update or Download that fails, or is refused because a roast started meanwhile, says so in a toast; a failed check stays in the line.

## Your data across updates

- Settings, roasts, beans and profiles live in the app's user-data folder, which an update never touches.
- **Backup before migrations:** when a new version has database migrations to run, the app first copies the database to `backups/roastpilot-before-<new version>-<date>.db` in the user-data folder (SQLite `VACUUM INTO`, a clean copy; a second one the same day gets `-2`). The name says which update it came before: the database doesn't record which app version wrote it. A new, empty database needs no backup. The last 5 backups are kept; other files in the folder are left alone. If the backup fails, migrations don't run and History says why, as when the database can't open.
- An older app never opens a database a newer one migrated (it reports it as unreadable and leaves it alone).
