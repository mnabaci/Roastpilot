# Badge

A short uppercase status label beside a name or a value: AUTO, MANUAL, BUILT-IN, EDITED, LOW STOCK.

## Anatomy

- **Chip**: `radius-sm`, 4px × 8px padding (`space-1` × `space-2`), `badge` type (11px/700, 0.06em tracking), upper case set by the style: write the text in sentence case ("Built-in"), it shows as `BUILT-IN`.

## Tones

- **Air** (`air` on `air-tint`): Auto drives it, or it is live: Auto on an output or a profile, the Active roaster, today's Live log, the Info log level.
- **Heat** (`heat` on `heat-tint`): you drive it, or it wants a look: Manual, Edited, Not saved, Low stock, the Error and Warning log levels.
- **Neutral** (default, `ink-muted` on `surface-raised`): facts with no action: Built-in, Archived, Needs calibration, Unfinished, the Debug log level.

## Rules

- One or two words. A badge is a state, never an action: it is a `span`, not a button.
- Next to the thing it describes (after a title, in a list row's end, before a value), never alone.
- No `critical` or `warning` tones: safety lives in AlertBanner, and red text stays for Delete.
- In a row that can be narrow, the badge keeps its size (`shrink-0`) and the name truncates first. It never wraps onto two lines (`whitespace-nowrap`).
