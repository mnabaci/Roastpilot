# EventTable

A saved roast's events with the values at each moment, on the History screen under the stats. Secondary information: the chart stays the main view.

## Anatomy

- **Card**: `surface` fill, `radius-xl`, `space-4` padding; a `table` with rules between rows (1px `border`), no outer border.
- **Header**: Event · Time · Temp · RoR · Heater · Fan, in `label` `ink-muted`; numbers right-aligned. The temperature column takes the roaster's short name for its sensor (`tempLabel`: `Temp` on the Skywalker, whose probe is the drum where it touches the beans; `BT` on a roaster with a bean probe).
- **Rows**: `label` size, `ink`, tabular: `First crack · 9:31 · 191.3 °C · 7.6 · 30 % · 100 %`. A value the roast didn't have is a dash.
- **Order**: Charge, Turning point, First crack, Drop, Cool end (or End), as they happened.

## Rules

- Values come from the saved readings at each event, so older roasts get the table too.
- No colour beyond `ink` and `ink-muted`: it is a reading aid, not a highlight.
- The table has an accessible name ("Events").
