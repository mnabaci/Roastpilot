# Skywalker TC4 firmware

`SkyCommand/SkyCommand.ino` is the sketch Roastpilot talks to, running on an ESP32-WROOM-32 wired
to the Skywalker's controller line (TX pin 23, RX pin 22). It is adapted from
[jmoore52/SkywalkerRoaster](https://github.com/jmoore52/SkywalkerRoaster) through
[mnabaci/SkywalkerRoaster](https://github.com/mnabaci/SkywalkerRoaster); credit for the
reverse-engineered protocol and the original sketch goes to that project.

## Changes from upstream

- ESP32 pins.
- `VERSION` replies with the protocol version.
- Serial is read without blocking and every line runs as its own command, so commands sent close
  together are no longer merged and lost. Still works with Artisan.

## License

GPL-3.0, see [LICENSE](LICENSE). Keep it and this credit next to the sketch.

## Flashing

```sh
arduino-cli core install esp32:esp32
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/skywalker-tc4/SkyCommand
arduino-cli upload --fqbn esp32:esp32:esp32 -p /dev/cu.usbserial-0001 firmware/skywalker-tc4/SkyCommand
```

On Windows use the board's `COMx` port. The board starts in °F after flashing; the driver sends
`UNITS;C` on connect.

## Protocol

Documented in [docs/spec/hardware.md](../../docs/spec/hardware.md): 115200 baud, one text command
per line (`READ`, `OT1` heater, `OT2` fan, `COOL`, `FILTER`, `DRUM`, `OFF`, `ESTOP`, `UNITS;C`,
`VERSION`).

Protocol version: `1` (the sketch's reply to `VERSION`). Any change goes through the
`firmware-change` skill and bumps this number together with the SkyCommand dialect (`sky-command-dialect.ts`).
