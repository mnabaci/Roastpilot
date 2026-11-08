# OutputControl

A slider for one roaster output (heater, fan, or a drum with a speed) with its value, and an Auto/Manual badge while Auto drives the roast.

## Behaviour

- While Auto drives the roast (Preheat until Drop): moving the slider switches that output to Manual and a "Resume auto" button appears under it (Button ghost, `sm`, at the start).
- In a manual roast there is nothing to tell apart: no badge, no Resume auto.
- Steps follow the roaster's channel definition (Skywalker: 5%).
- Disabled outside the roast; the value still shows. With no reading (no roaster, or not a number) the value is a dash and the slider is disabled.
- The value moves as you drag; it is sent once, when you let go, 300 ms after the last arrow key, or when focus leaves.
- A drum with a speed is never driven by Auto, so it has no badge. An on/off drum stays a Switch.

## Sizes

- **md** (default): the Roast screen's outputs, readable from 1–2 m.
- **sm**: a value set once and rarely watched, in a row of other fields (a sound's Volume in Settings › Sounds). Label above, the same as a field label, so it lines up with the selects beside it; the value in body text.

## Visuals

- **md:** label `body` at 600 in `ink`; value `readout-lg`, right-aligned, tabular; 10px between the label row and the slider.
- **sm:** label `label` in `ink-muted`; 6px to the slider; value `body` weight 600, right-aligned, tabular; no badge or Resume auto (never an Auto output).
- Badge (the Badge component), 10px before the value: AUTO in the `air` tone (`air` text on `air-tint`); MANUAL in the `heat` tone (`heat` text on `heat-tint`).
- Track drawn by the app, never the browser's: 8px (`space-2`) `radius-full` track in `border-strong`, filled up to the value in the output's colour (`heat-fill` heater, `air` fan, `ink-muted` drum speed and volume: neutral, neither heat nor air), and a 20px (`space-5`) thumb in that colour with a 2px `surface` ring. The same in both themes. Disabled: 50% opacity. Track hit area 28px in md; in sm 44px (`control-sm`), as tall as the fields beside it so their labels and controls line up.
