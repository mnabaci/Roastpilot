# Skywalker TC4 firmware

Roastpilot talks to the SkyCommand sketch from
[jmoore52/SkywalkerRoaster](https://github.com/jmoore52/SkywalkerRoaster)
(`SkyCommand/SkyCommand.ino`), running on an ESP32-WROOM-32 wired to the Skywalker's controller
line. Credit for the reverse-engineered protocol and the sketch goes to that project.

## License

The sketch is GPL-3.0. If a copy is added here, keep its `LICENSE` file and this credit next to
it. Until then, flash the latest upstream sketch as-is.

## Protocol

Documented in [docs/spec/hardware.md](../../docs/spec/hardware.md): 115200 baud, text commands
(`READ`, `OT1` heater, `OT2` fan, `COOL`, `FILTER`, `DRUM`, `OFF`, `ESTOP`, `UNITS;C`, `VERSION`).

Protocol version: `1` (the sketch's reply to `VERSION`). Any change goes through the `firmware-change` skill and bumps this
number together with `Tc4SkywalkerDriver`.
