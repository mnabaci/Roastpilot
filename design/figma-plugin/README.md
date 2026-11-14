# Roastpilot design system builder (Figma plugin)

Builds the rest of the Roastpilot design system inside the **Roastpilot Design System** Figma file. That
file already has the variables, text styles, icons and the first 23 components. This plugin adds the rest:

- TextAreaField, Select (+ Option), FilterSelect, StarRating
- Mark (and puts it on the cover), NavList (+ Item), ErrorState, SidebarLayout
- StatCard, PhaseStepper (+ Step), OutputControl, CoachCard, RoastStrip
- RoastList (+ Row), RoastTable, EventTable, CompareTable, RoastChart, StockChart
- RecordHeader, and an example bean page on the Cover page

It runs inside Figma, so it doesn't use the Figma MCP call allowance.

## Run it

1. Open the Figma **desktop** app. Development plugins only run there.
2. Open the Roastpilot Design System file.
3. Go to **Plugins → Development → Import plugin from manifest…** and pick
   `design/figma-plugin/manifest.json` in this repo.
4. Go to **Plugins → Development → Roastpilot design system builder**.

When it finishes, a message at the bottom of the screen says what was built, what was skipped and what
failed. If a step fails, the others still run. Running it again is safe: each step skips anything that's
already there.

Charts are illustrations of the live uPlot charts, built from fixed sample data.
