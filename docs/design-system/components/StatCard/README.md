# StatCard

A big live number with a label above and one line of context below.

## Anatomy

- Label: `label`, `ink-muted`.
- Value: `readout-xl`, tabular numerals; unit beside it at 20px `ink-muted`.
- Context: `label`, `ink-muted` (e.g. "Target 186 °C", "Last 30 s").
- Secondary reading (optional): on the label's row, right-aligned: its name in `label` `ink-muted`, its value at `heading` (20px) with tabular numerals, its unit in `label` `ink-muted`. One per card, for a second sensor that belongs with the main one: ET beside the temperature ("ET 212.4 °C"). A dash when it has no value yet.

## Colour

- Temperature values use `heat`; rate of rise uses `air`; ET (environment temperature) uses `env`; everything else `ink`.
- Show `—` when there is no value yet; never 0 for unknown.
- A negative value uses the real minus sign (U+2212): `−7.7`, never a hyphen.

## Layout

- `surface` card, `radius-xl`, padding 18px 20px. Four in a responsive grid (min 210px each), gap `space-4`.
