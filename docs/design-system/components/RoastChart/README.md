# RoastChart

The live roast chart: temperature against the target curve, rate of rise on a right axis, and the ghost roast behind; heater and fan in a strip underneath.

## Layers (back to front)

1. Phase bands (an aid, below): behind the grid.
2. Grid: `border`, 1px.
3. Drop temperature line: `critical-text`, 1px dotted, labelled "Drop 212 °C".
4. Ghost temperature and RoR: `ghost`, 2px.
5. Target curve: `target`, 2px dashed 6 6.
6. RoR: `air`, 2px, right axis 0–30 °C/min.
7. Live temperature: `heat`, 3.5px, round joins; current point as a 6px dot.
8. Event markers (First crack, Drop): 1.5px dashed vertical in `ink`, ghost's in `ghost`, labelled at the top.
9. Projection and now line (aids, below), then the current-point dot on top.

## Aids (during a roast)

Drawn faint, so they never compete with the curves; none has a legend entry or a hover value. Each is a switch in Settings › Chart.

- **Phase bands:** full-width fills of `ink` at 3 %, 6 % and 9 % for drying, Maillard and development, darker as the beans are. Each is named once at its left edge (just right of the Charge line when it is in view), `label` style in `ink-muted`, 8px in: at the bottom of the band, or its top when a curve runs there, on a chip of the band's own shade so grid lines and markers never cut through the name. A band with no free spot, or too thin, has none: a name never hides a curve.
- **Projection:** a straight 2px line in the colour of the line it continues (`heat` for temperature), dashed 4 4 with round caps, at 55 % opacity: dotted-looking, so it never reads as the target's 6 6 dashes.
- **Now line:** 1px solid `ink-muted` at 55 % opacity through the chart and the outputs strip; the hover line is the dashed one.
- **Time window and temperature floor:** the chart can be given a time span and a lowest temperature (with Temperature focus, fitted below the expected turning point in 25 °C steps); the axes don't move while you hover.

## Header

- Title (`heading`) on the left, with an optional quiet control beside it (History's Show preheat: a `sm` ghost button, `heat-tint` while on); the legend on the right.

## Outputs strip

- A 96px band under the chart, same width, time axis and event markers (unlabelled there), 12px gap.
- Heater: `heat`, 2px step line. Fan: `air`, 2px step line. Left axis 0 / 50 / 100 %.
- Steps change at the moment the output changed, so each change lines up with the curve above.
- Its time labels are the chart's; the strip shows none of its own.

## Hover

- Pointing at the chart or the strip draws one 1px dashed `ink-muted` line through both.
- The legends show the values there: the time first (`label`, semibold, `ink`), then each layer's value after its name in semibold `ink` (`Temperature 198.4 °C`); a dash where a layer has no value. Leaving brings the names back.

## Rules

- Legend above the chart, always, listing every line (strip lines too; aids are not listed). Axis labels `label` in `ink-muted`; time in minutes.
- Each layer is a pluggable ChartLayer: a line, or an aid (`now-line`, `projection`, `phase-bands`); a roaster with extra probes adds layers, not chart code. A line on the `output` axis goes to the strip.
- Built with uPlot in the app; this preview is static SVG. Tests swap the drawing for a fake through `PlotEngineProvider` (jsdom has no canvas), never by mocking modules.
