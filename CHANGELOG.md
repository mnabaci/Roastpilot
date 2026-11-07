# Changelog

All notable changes to Roastpilot are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions will follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-11-07

### Fixed

- **macOS:** the app opens again: 0.1.0 wasn't signed at all, so macOS called it damaged. 0.1.1 is
  ad-hoc signed; macOS asks once, then Privacy & Security → Open Anyway.
- **Security:** build tools updated for three security alerts (esbuild, glob, minimatch). Nothing
  changes in the app.

## [0.1.0] - 2026-11-07

The first release.

### Added

- **Roasters:** connect a modded Skywalker over USB serial (SkyCommand sketch, protocol version 1)
  or the built-in Simulator. Roaster records with batch sizes, safety limits, temperature offset,
  preheat hold, PID tuning and drum speed. The app remembers the roaster and lists likely ports.
- **Safety:** max temperature, lost connection, max roast time and stalled-temperature rules on
  every reading and every second; Emergency stop; heater lock until you acknowledge; safe stop on
  quit, sleep and crash; the computer kept awake while a roaster is connected.
- **Manual roasting:** Preheat, Start, First crack, Drop and Cool, with heater, fan, drum and
  filter controls; charge point and turning point found on their own; bean cooling and drum
  cooling side by side after Drop; End roast.
- **Auto:** step profiles (end temperature, duration and RoR range per step, planned fan) and curve
  profiles that follow the curve's rate of rise. Between-batch preheat, dry end by temperature,
  development time after first crack, auto drop and cooling. Hand any output back to manual and
  Resume auto. Shows how far the roast is from its plan and what RoR the step aims for.
- **Profiles screen:** built-in Light profile for the Skywalker; duplicate, edit steps and curve
  points with a preview; build a curve from milestones.
- **Live chart:** temperature and RoR with smoothing, the profile's curve, markers and an
  outputs strip for heater, fan and drum. Hover to read values.
- **History:** every roast saved to a local SQLite database; compare roasts, star favourites, make
  a step or curve profile from a roast, delete. Export as Roastpilot files or CSV; import
  Roastpilot files and Artisan `.alog` roasts.
- **Beans:** bean library, green stock that goes down with each roast, weight loss, and a batch
  calculator.
- **Ghost roasts:** a past roast drawn behind the live curve, picked for you, changeable.
- **Sounds:** cues for charge soon, beans in, listen for first crack, dump beans and Auto stopped,
  each with its own voice, volume and repeat.
- **Logs screen:** the app's log, live, and Open log folder in the app menu.
- **Install and update:** installers on GitHub Releases. Windows updates in the background and
  installs on quit or Restart to update, never mid-roast; macOS says when a new version is out.
  Settings › About shows the version and updates. The database is backed up before migrations.
- **Safety notice** on first launch: Roastpilot switches a heater, so stay with the roaster.
  Help → Safety notice shows it again.
- **Theme:** Dark, Light or Match system, in Settings › Appearance.
- **Toasts** for actions that fail or are refused, and for import and export results.
