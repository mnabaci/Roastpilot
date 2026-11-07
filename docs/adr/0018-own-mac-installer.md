# 0018: Roastpilot installs its own Mac updates until it has a Developer ID

Status: accepted
Date: 2026-11-07

## Context

ADR 0017 left macOS with a Download button: electron-updater hands Mac updates to Squirrel, which installs one only when its code signature satisfies the installed app's designated requirement. An ad-hoc signature's requirement is its own code hash, so every new build fails it. An Apple Developer ID (99 USD a year) is not an option for now, and there is no free certificate for distribution. The owner wants Mac updates in the background, as on Windows.

## Decision

- **Our own Mac installer** behind the core `Updater` interface: electron-updater still finds the release (`latest-mac.yml`); Roastpilot downloads the `.zip`, checks size and SHA-512 against `latest-mac.yml`, unpacks it with `ditto` and checks the app inside (`codesign --verify --deep --strict`, bundle id, version) before it counts as ready.
- **Installed after the app has quit**, by a helper that swaps the bundle (keeping the old one until the new one is in place, and putting it back on any failure), after the quit guard's shutdown, never during a roast (`UpdateService` decides, as on Windows).
- **Falls back to Download** when the app can't replace itself (DMG, App Translocation, a folder it can't write).
- `UpdateService` and About don't change: `canInstall` becomes true on macOS when the installer can replace the app.

## Consequences

- Mac updates work like Windows for free; no Gatekeeper prompt after the first install, as the app's own downloads carry no quarantine.
- Trust rests on HTTPS to GitHub plus the checksum and signature checks: they stop a corrupted or altered download, not a bad release published from the repository. A Developer ID would; adding one later deletes this installer and switches macOS to electron-updater's (config and the platform check only).
- More code to own: the download, the checks and the swap, each with tests for its failures.
