# StatCard

A big live number with a label above and one line of context below.

## Anatomy

- Label: `label`, `ink-muted`.
- Value: `readout-xl`, tabular numerals; unit beside it at `heading` (17px) `ink-muted`.
- Context: `label`, `ink-muted` (e.g. "Target 186 °C", "Last 30 s").
- Secondary reading (optional): on the label's row, right-aligned: its name in `label` `ink-muted`, its value at `heading` (17px) with tabular numerals on the label's line height, so the row stays the label's height and the readout lines up with the cards beside it, its unit in `label` `ink-muted`. One per card, for a second sensor that belongs with the main one: ET beside the temperature ("ET 212.4": no unit when it shares the main value's). The label truncates before the second reading does. A dash when it has no value yet.

## Colour

- Temperature values use `heat`; rate of rise uses `air`; ET (environment temperature) uses `env`; everything else `ink`.
- Show `—` when there is no value yet; never 0 for unknown.
- A negative value uses the real minus sign (U+2212): `−7.7`, never a hyphen.

## Layout

- `surface` card, `radius-xl`, padding 18px 20px. Four in a responsive grid (min 210px each), gap `space-4`.
