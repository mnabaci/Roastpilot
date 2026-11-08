# CoachCard

In a manual roast, shows what Auto would set now and why, with a one-tap Apply; or a heads-up before first crack or drop.

## Suggestion

- Label: "Coach suggests" in `label`, `ink-muted`; with a profile that needs calibration, on the same line: "Coach suggests · needs calibration" (the setup card names the profile).
- The changes as aligned rows, one per output (a real table, so the values line up):
  - the output's name in `body` at 600, `ink`: the same words and weight as its slider below, so it reads at a glance;
  - at the right edge, in line with Apply and the slider values: where it is now in a quiet box (no fill, 1px `border-strong`, `radius-md`, `body` in `ink-muted`), a 16px ArrowRight in `ink-muted`, then the target in `readout-lg` in a box with a `surface` fill, outlined and written in the output's colour (`heat` heater, `air` fan).
  - No change column: the two boxes already say it.
- Screen readers hear each row as "Heater from 75% to 65%".
- The reason in `body`, `ink-muted`, one line, right under the change (2px): "4 °C below target, RoR falling".
- Actions at the right end: Dismiss (Button Outline), then Apply (primary, its natural width), both 44px, as every choice in the app. While Apply's call is on its way it reads "Applying…", is disabled and `aria-busy`, so a double click can't send twice.
- `heat-tint` background, 1px `heat` border: it asks for a heat action.

## Heads-up

- No change to make, so no Apply: the line in `body` `ink` ("First crack in ~45 s · listen", "Drop in ~30 s · 1:45 development") and Dismiss (Button Outline) at the right end.
- `surface-raised` background, 1px `border`: neutral, because nothing is asked of the heater.

## Rules

- One card at a time: a new suggestion replaces the last, never stacks; at most one new suggestion every 15 s.
- Sits above OutputControl on the Roast screen, only in a manual roast from Start to Drop; never in Auto.
- Compact: padding 16 × 12px, 8px between blocks, so the heater slider stays in view at 960 × 640.
- No icons needed. Buttons keep 44 px targets.
