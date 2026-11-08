# StatCard

A big live number with a label above and one line of context below.

## Anatomy

- Label: `label`, `ink-muted`.
- Value: `readout-xl`, tabular numerals; unit beside it at 20px `ink-muted`.
- Context: `label`, `ink-muted` (e.g. "Target 186 °C", "Last 30 s").

## Colour

- Temperature values use `heat`; rate of rise uses `air`; everything else `ink`.
- Show `—` when there is no value yet; never 0 for unknown.
- A negative value uses the real minus sign (U+2212): `−7.7`, never a hyphen.

## Layout

- `surface` card, `radius-xl`, padding 18px 20px. Four in a responsive grid (min 210px each), gap `space-4`.
