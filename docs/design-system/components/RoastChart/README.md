# RoastChart

The live roast chart: temperature against the target curve, rate of rise on a right axis, and the ghost roast behind; heater and fan in a strip underneath.

## Layers (back to front)

1. Grid: `border`, 1px.
2. Drop temperature line: `critical-text`, 1px dotted, labelled "Drop 212 °C".
3. Ghost temperature and RoR: `ghost`, 2px.
4. Target curve: `target`, 2px dashed 6 6.
5. RoR: `air`, 2px, right axis 0–30 °C/min.
6. Live temperature: `heat`, 3.5px, round joins; current point as a 6px dot.
7. Event markers (First crack, Drop): 1.5px dashed vertical in `ink`, ghost's in `ghost`, labelled at the top.

## Outputs strip

- A 96px band under the chart, same width, time axis and event markers (unlabelled there), 12px gap.
- Heater: `heat`, 2px step line. Fan: `air`, 2px step line. Left axis 0 / 50 / 100 %.
- Steps change at the moment the output changed, so each change lines up with the curve above.
- Its time labels are the chart's; the strip shows none of its own.

## Hover

- Pointing at the chart or the strip draws one 1px dashed `ink-muted` line through both.
- The legends show the values there: the time first (`label`, semibold, `ink`), then each layer's value after its name in semibold `ink` (`Temperature 198.4 °C`); a dash where a layer has no value. Leaving brings the names back.

## Rules

- Legend above the chart, always, listing every layer (strip layers too). Axis labels `label` in `ink-muted`; time in minutes.
- Each layer is a pluggable ChartLayer; a roaster with extra probes adds layers, not chart code. A layer on the `output` axis goes to the strip.
- Built with uPlot in the app; this preview is static SVG. Tests swap the drawing for a fake through `PlotEngineProvider` (jsdom has no canvas), never by mocking modules.
