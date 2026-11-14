# 0026: One TC4 driver with dialects

Status: accepted
Date: 2026-11-14

## Context

The Skywalker's SkyCommand sketch speaks Artisan's TC4 text protocol (`READ`, `OT1`, `OT2`,
`UNITS;C`) with a few commands of its own (`COOL`, `FILTER`, `DRUM`, `VERSION`, `ESTOP`). The
stock TC4 firmware (aArtisanQ_PID), which many home-built roasters run, speaks the same protocol:
checked against its source, its `READ` reply has the same six-field shape. A second driver class for
it would repeat most of `Tc4SkywalkerDriver`: the command queue, the handshake, polling, rounding to
steps, the board-echo check and the errors.

## Decision

One `Tc4Driver` in `drivers`, built with a `Tc4Dialect`: plain data saying which command drives
each output, which lines answer `READ` and how to read them, what the handshake sends and checks
(SkyCommand: `UNITS;C`, `VERSION`), and the safe-stop sequence with its fallback. SkyCommand and
Stock TC4 are two dialects; what the stock firmware needs beyond that (its boot wait, `CHAN`, its
`#` acknowledgements, reading every input) arrives with its dialect. The stock dialect is built from
the roaster record's wiring (inputs, outputs, baud), so a home-built roaster is a record, not code.

The refactor ships first, on its own, with no behaviour change: the Skywalker driver's tests run
unchanged against `Tc4Driver` with the SkyCommand dialect.

## Consequences

- A TC4-style board is a new dialect (data) and a model definition; no new driver class.
- Hardware with another protocol (binary, Modbus, Wi-Fi) still gets its own driver class behind
  `RoasterDriver`: the dialect is the TC4 driver's extension point, not every driver's.
- Behaviour that only one board has (SkyCommand's version check, the stock firmware's boot wait and
  `CHAN`) lives in that dialect; each dialect has its own driver test file
  (`tc4-driver.<dialect>.test.ts`), and the driver refuses a dialect whose safe stop names an output
  it doesn't have.
- A dialect can't express a board that needs a different conversation (binary frames, push
  instead of poll); that is a new driver, which is the right cost for it.
