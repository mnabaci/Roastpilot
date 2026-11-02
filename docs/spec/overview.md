# Overview

A simple macOS desktop app (Electron) that roasts automatically on a modded Skywalker roaster:
pick Light, Medium or Dark, press Start, and the app drives heater and fan to follow that
profile's curve, then drops and cools on its own. It replaces Artisan for day-to-day roasting.

| Topic                 | Decision                                                                        |
| --------------------- | ------------------------------------------------------------------------------- |
| Automation            | Full auto, plus a Manual mode with a live coach                                 |
| Roasters              | Plug and play: each roaster record holds driver, batch sizes, limits and tuning |
| Conditions            | The PID reacts live to the roaster's sensor; no weather data, no extra steps    |
| Profiles              | Built-in Light / Medium / Dark (read-only) plus custom profiles                 |
| Beans                 | Bean library; every roast is linked to a bean                                   |
| Stock                 | Green stock per bean, roasted weight and weight loss per roast                  |
| Batch calculator      | Splits an order into batches; equal splits or ideal + leftover, you pick        |
| Favourites            | Star any roast; turn a favourite into a custom profile                          |
| Ghost layer           | A past roast drawn behind the live curve; auto-picked, changeable               |
| Dry end / first crack | Dry end marked automatically by temperature; first crack with a button press    |
| End of roast          | Auto drop: heater off, cooling on, prompt to dump beans                         |
| Safety                | Max temp cutoff, lost-connection stop, max roast time, stalled-temp alarm       |
| Storage               | Local SQLite file                                                               |
| Platform              | macOS laptop first                                                              |

Out of scope for v1: microphone crack detection, cloud sync and the phone app, running several
roasters at once, Windows and Linux builds.
