# RoastTable

Saved roasts side by side, one row each, on a bean's page (Beans screen) under its facts. For reading and comparing roasts of one bean: the numbers line up down each column.

## Anatomy

- **Card**: `surface` fill, `radius-xl`, `space-4` across and `space-3` down; a `table` with rules between rows (1px `border`), no outer border, as in EventTable.
- **Header**: Roast · Ran as · Time · FC · Drop · Green → roasted · Loss · Rating, in `label` `ink-muted`; the numbers' headings right-aligned over their columns.
- **Rows**: `label` size, tabular, 10px top and bottom.
  - **Roast**: the date and time in `ink` semibold (`Sun 8 Nov · 16:45`), with a filled `heat` star after it for a favourite. Never wraps.
  - **Ran as**: `Auto · Light · Curve` or `Manual`, in `ink-muted`. It takes the room the numbers leave and truncates (full text on hover), so a long profile name never squeezes a number.
  - **Numbers**: `ink`, right-aligned, never wrap: total time `10:20`, first crack `8:34`, drop temperature `197.0 °C`, `356 → 305 g` (just `356 g` before the roast is weighed), loss `14.3 %`, rating `5/5`. A value the roast didn't have is a dash.

## Rules

- Rows are not buttons: the table is for reading. Opening a roast is History's job.
- No colour beyond `ink`, `ink-muted` and the favourite star.
- The table has an accessible name ("Roasts of African Moon"); the date is each row's header.
- Newest first, as the list it replaces.
