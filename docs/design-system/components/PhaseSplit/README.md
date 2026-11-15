# PhaseSplit

A roast split into its phases: History's Roast report and the Roast just finished card. Drying, Maillard and Development; Before first crack and Development when dry end can't be placed.

## Anatomy

- **Bar**: 10px high, rounded at its ends, one segment per phase as wide as its share, 2px apart so the surface shows between them.
- **Legend** under it, each phase's column as wide as its segment, so its numbers sit under it: an 8px dot in the segment's fill, the phase's name in `label` / `ink-muted`, its length and share in `body` / `ink` (`4:24 · 40 %`), then where it ended in `label` / `ink-muted` (`to 150.2 °C`); numbers tabular. An estimate reads `≈`, said as "about".
- A column is never narrower than 88px, so a short phase's name fits; its segment widens with it and the others give way, so bar and legend stay lined up.

## Rules

- Neutral fills only, stronger further into the roast as the chart's phase bands: `target` at 30 %, 60 % and 100 %, so the steps read the same in light and dark. A longer phase isn't better or worse, so never a state colour.
- The shares shown add up to 100 %.
- The bar is decoration (`aria-hidden`); the legend is a description list in a group named "Phases".
- No phases: nothing shows.
