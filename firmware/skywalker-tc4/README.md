# Skywalker TC4 firmware

Roastpilot talks to the SkyCommand sketch from
[jmoore52/SkywalkerRoaster](https://github.com/jmoore52/SkywalkerRoaster)
(`SkyCommand/SkyCommand.ino`), running on an Arduino Leonardo wired to the Skywalker's controller
line. Credit for the reverse-engineered protocol and the sketch goes to that project.

## License

The sketch is GPL-3.0. If a copy is added here, keep its `LICENSE` file and this credit next to
it. Until then, flash the upstream sketch as-is.

## Protocol

Documented in [docs/spec/hardware.md](../../docs/spec/hardware.md): 115200 baud, text commands
(`READ`, `OT1` heater, `OT2` fan, `COOL`, `FILTER`, `DRUM`, `OFF`, `ESTOP`, `UNITS;C`).

Protocol version: `1`. Any change goes through the `firmware-change` skill and bumps this
number together with `Tc4SkywalkerDriver`.
