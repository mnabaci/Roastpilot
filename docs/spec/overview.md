# Overview

A simple desktop app for macOS and Windows (Electron) that roasts automatically on your roaster, starting with a modded Skywalker:
pick Light, Medium or Dark, press Start, and the app runs that profile's heat and fan steps,
correcting drift as it goes, then drops and cools on its own. It replaces Artisan for day-to-day roasting.

## Who it's for

| User                    | Hires Roastpilot to                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Home roaster            | Get good, repeatable roasts on their own machine without watching every second; learn by doing in Manual        |
| Small roasting business | Get the same coffee batch after batch, on its own roasters, from any staff member; keep a record of every batch |
| First-time user         | Roast safely within minutes: connect, pick bean and profile, Start                                              |

## What it isn't

- **Not Artisan with every knob:** good defaults, few settings.
- **Not a dashboard mid-roast:** only what helps the next decision.
- **Not tied to one roaster:** the Skywalker first, everything per roaster record.
- **Not a shop or ERP:** stock and batches serve roasting; no orders, invoices or customers.
- **Not a textbook:** the coach speaks in one line.

Every request that changes what users see or do is checked against these first (`challenge` skill).

## Decisions

| Topic                 | Decision                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automation            | Full auto, plus a Manual mode with a live coach                                                                                                                                               |
| Roasters              | Plug and play: each roaster record holds driver, batch sizes, limits and tuning                                                                                                               |
| Conditions            | Step targets the PID reaches inside a RoR range; preheat runs the between-batch protocol; no weather data                                                                                     |
| Profiles              | Step profiles (end temperature, duration and RoR range, with a planned fan) and curve profiles (PID follows a BT curve), same format; per roaster; built-in Light / Medium / Dark plus custom |
| Beans                 | Bean library; every roast is linked to a bean                                                                                                                                                 |
| Stock                 | Green stock per bean, roasted weight and weight loss per roast                                                                                                                                |
| Batch calculator      | Splits an order into batches; equal splits or ideal + leftover, you pick                                                                                                                      |
| Favourites            | Star any roast; turn a favourite into a custom profile                                                                                                                                        |
| Ghost layer           | A past roast drawn behind the live curve; auto-picked, changeable                                                                                                                             |
| Dry end / first crack | Dry end marked automatically by temperature; first crack with a button press                                                                                                                  |
| End of roast          | Auto drop: heater off, cooling on, prompt to dump beans                                                                                                                                       |
| Safety                | Max temp cutoff, lost-connection stop, max roast time, stalled-temp alarm                                                                                                                     |
| Storage               | Local SQLite file                                                                                                                                                                             |
| Platform              | macOS and Windows: macOS DMG and Windows installer                                                                                                                                            |

Out of scope for v1: microphone crack detection, cloud sync and the phone app, running several
roasters at once (one app per roaster for now), Linux builds.
