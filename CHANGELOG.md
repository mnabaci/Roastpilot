# Changelog

All notable changes to Roastpilot are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version numbers say how much changed for
a roast: minor for roasting features, patch for everything else
([how versions are picked](docs/spec/install-and-update.md#version-numbers)).

## [Unreleased]

## [0.3.0] - 2026-11-09

### Added

- **Auto or Manual on every roast:** History says how each roast ran, with the profile's name for
  Auto, in the list and as a badge on the open roast.
- **Order link on a bean:** paste where you bought it, then Order again opens it in your browser.
- **A roast table on the bean page:** each roast's time, first crack, drop, green → roasted weight,
  loss and rating, and how it ran. Click a row to open that roast in History.

### Changed

- **A bean's details are a card of tiles**, with its hints underneath, using the width of the
  window.

### Fixed

- **Auto's stall guard no longer trips at the start of Maillard**, when RoR falls fast after the
  heater steps down but levels out well above a stall. It still trips on a roast that's really
  stalling.

## [0.2.0] - 2026-11-08

### Added

- **°F:** Settings › Appearance › Temperature shows and takes every temperature in °F; RoR and
  offsets scale by 1.8 (10 °C/min reads 18 °F/min). Roastpilot files stay in °C.
- **Export and import beans, profiles and roasters** as Roastpilot files, from each screen's "⋯",
  like roasts. Nothing of yours is overwritten: a clash comes in as "(imported)".
- **Select several profiles** to export or delete in one go.
- **Move a step** in the profile editor by its handle, or with Alt+↑ / Alt+↓.
- **Mark as calibrated** on your own profiles.
- **Preheat hold by batch:** a shorter hold when a roast ended in the last 20 minutes, shown before
  Start and changeable for that roast.
- **A note when the batch is more than 10 % off** what the profile is tuned for.

### Changed

- **The built-in Skywalker Light profiles and Auto's default gains are retuned** from real Auto
  roasts (356 g batch, new heat estimates, last step "To first crack"). Your own profiles and an
  existing roaster's gains keep their values.
- **The profile editor** shows the preview under the top values, with steps and curve points side
  by side.
- **During a roast** the chart legends show the latest values, the top bar names the roaster, and
  "Stay with the roaster" shows above Preheat.
- **"End roast" is "Stop preheat" or "Stop roast"**, and History marks a stopped roast.
- **Start is offered from the preheat hold on**, not while the drum is still cooling or climbing.
- **The setup card** labels the suggested profile and says why; bean hints name their cause.
- **A copy to another roaster** is named after where it came from, and only one is made.
- **An unplugged roaster's banner** offers Disconnect instead of an Acknowledge that can't work.

### Fixed

- A profile edit undone by hand no longer shows Edited with no Save.
- Previewing an "Until done" sound plays it once.
- The finished roast card's Done is remembered across tabs; Clear says the roast stays in History.
- Profiles saved with a 1970 date now get the real one.
- Switching °F back to °C no longer shifts profile values you didn't touch.
- The now line breaks under a marker label instead of running through it.
- Importing a file that's empty, too big or from a newer version says so clearly.

## [0.1.2] - 2026-11-08

### Added

- **Roast chart aids:** while roasting, a faint projection of where the temperature is heading at
  this RoR, a now line, a temperature axis fitted to the roast, and drying, Maillard and
  development bands behind the curve; each is a switch in Settings › Chart.
- **Coach in manual roasts:** a card above the sliders suggests what Auto would set now, and why,
  with Apply; and a heads-up before first crack and before drop.
- **macOS updates install by themselves**, as on Windows: downloaded in the background, checked,
  and installed when you quit or press Restart to update, once Roastpilot is in Applications.

### Changed

- **The roast chart focuses on the roast:** from Start it shows 0:30 before charge to a minute past
  the expected drop, growing smoothly if the roast runs long; the preheat is still saved.
- **History opens each roast's chart on the roast**, with Show preheat to see everything recorded.
- **Each profile sets its own soak**, or none; the Soak time setting moved into profiles.
- **A calmer, more consistent look on every screen:** matching sizes and spacing, buttons for a
  choice at the right with the quiet one first, and clearer Dismiss and Done buttons.

### Fixed

- The Simulator no longer jumps to the hot drum's temperature at Drop, which tripped Too hot.
- The Drop label no longer sits on the chart's current point.
- A fresh install no longer logs a warning about the roaster's connection.

## [0.1.1] - 2026-11-07

### Changed

- **Resume auto** in a curve phase picks up from the heater as you left it and moves 5% per 10 s
  to the phase's own value, instead of jumping to it.
- **Settings › Sounds:** a compact Volume slider that lines up with Voice and Repeat.
- **Edit menu:** only Undo, Redo, Cut, Copy, Paste and Select All; macOS's Dictation, Emoji and
  AutoFill items are switched off.

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
