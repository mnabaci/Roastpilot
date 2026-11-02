# Skywalker TC4 firmware

The Arduino sketch Roastpilot talks to, for a Skywalker roaster modded as described in
[jmoore52/SkywalkerRoaster](https://github.com/jmoore52/SkywalkerRoaster). Credit for the
reverse-engineered protocol and the original sketch goes to that project.

## Status

The sketch is not copied here yet. Before adding it, check the upstream repository's license
and keep its notice with the file. Until then, flash the upstream sketch as-is.

## Protocol (TC4-style text over USB serial)

| Command | Purpose |
| --- | --- |
| `READ` | Request current temperature; also keeps the sketch alive |
| `OT1;<0-100>` | Heater or fan duty % (mapping to confirm) |
| `OT2;<0-100>` | Fan or heater duty % (mapping to confirm) |
| `DRUM;100` / `DRUM;0` | Drum on / off |
| `FILTER;<0-4>` | Filter setting |

- Duty moves in 5% steps.
- The sketch shuts down after 10 s without a command; the roaster stops after about 1 s without a control message.

Protocol version: `1`. Any change here goes through the `firmware-change` skill and bumps this
number together with `Tc4SkywalkerDriver`.
