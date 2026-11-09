# CompareTable

Two roasts' numbers side by side with the difference, on History while comparing: under the chart, over the events.

## Anatomy

- **Card**: `surface` fill, `radius-xl`, `space-4` padding; a `table` with 1px `border` rules between rows and no outer border, like EventTable.
- **Header**: an unlabelled first column (named "Measure" for screen readers), then This roast · the compared roast's date and time (`Mon 2 Nov · 18:20`) · Difference, in `label` `ink-muted`, right-aligned over their numbers.
- **Rows**: `label` size, `ink`, tabular, values right-aligned: `First crack · 8:00 · 196.2 °C · 7:30 · 195.0 °C · +0:30 · +1.2 °C`. Rows: Total, Turning point, Dry end, First crack, Development, Drop temp, Weight loss, Rating, Profile, Bean.
- **Missing**: a dash where a roast has no value; the Difference is left blank where the two can't be compared (a value missing, or words such as Profile and Bean).

## Rules

- Differences are this roast minus the compared one, signed (`+0:54`, `−1.0 °C`, real minus U+2212), in `ink`: never green or red, as faster or hotter isn't better or worse.
- A temperature difference is ×1.8 in °F, never + 32, and whole like every °F number.
- The table has an accessible name ("Comparison").
