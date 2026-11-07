# 0015: Compact Roastpilot roast files (version 2)

Status: accepted
Date: 2026-11-07

## Context

A version 1 Roastpilot file ([ADR 0013](0013-roastpilot-roast-files.md)) is pretty-printed JSON, and
every sample repeats its channel names: `{ "tS": -39.024, "values": { "heater": 100, "fan": 30, … } }`.
An export of two roasts (about 2,200 samples) came to 488 KB. Most of that was whitespace and repeated
keys. Measured on the same file: no whitespace 195 KB; samples as columns, rounded to 0.1, 52 KB;
gzip 10–20 KB.

## Decision

Version 2 of the file:

- JSON without indentation, still plain text that any editor opens.
- Each roast's samples as columns: `{ "tS": [ … ], "values": { "bt": [ … ], "heater": [ … ] } }`,
  one list per channel, as long as `tS`, with `null` where a sample had no value for that channel.
- Times and values rounded to 0.1, which is what the sensors and the chart resolve.
- Everything else (summary, profile copy, events, names) stays as in version 1.

Import reads both versions; a version above 2 is refused as "from a newer Roastpilot". No gzip:
being readable and fixable by hand was worth more than the last 40 KB.

## Consequences

- Files are about 90% smaller (the example: 488 KB → 52 KB).
- A version 1 file still imports unchanged; older Roastpilot builds refuse version 2 files as newer.
- Values in a file are rounded to 0.1, so an exported and re-imported roast can differ from the
  original by up to 0.05 in any reading.
