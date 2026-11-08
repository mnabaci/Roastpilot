# RoastStrip

A slim row under the top bar on every screen but Roast, while a roast runs (Preheat to Cooling beans, or drum cooling). It answers one question: does anything need me?

## Anatomy

- **Row**: one full-width button (opens Roast), 44px tall, `space-6` side padding, `heat-tint` fill (a roast is heating), 1px `border` rule below. Fixed: it never scrolls, like the top bar.
- **Dot**: 8px `heat`, pulsing (still with reduced motion).
- **Lead**: the phase and its clock, `body` semibold in `heat` (`Roasting · 7:42`); while only the drum cools, where it is heading (`Cooling the drum · 92 °C → 50 °C`).
- **Numbers**: `label` name in `ink-muted`, value in `ink`, tabular, 16px apart: `Temp 182.4 °C`, `RoR 8.1`, `Heater 60 %`, `Fan 40 %`. The temperature takes the connected roaster's short name for its sensor (`Temp` on the Skywalker, `BT` on a roaster with a bean probe). A missing value is a dash.
- **Go**: a 20px chevron at the end, `ink-muted`.

## States

- **Quiet**: as above.
- **Needs you**: when the flow has a real prompt (Dump beans as bean cooling starts), the prompt leads in `heat` bold: `Dump beans · Cooling beans 3:58 left`. Never a guess like "First crack?".
- **Hover**: a slightly brighter `heat-tint`. **Focus**: 2px `focus` ring, inset.

## Rules

- Safety stays in the banners above it, never in the strip.
- Numbers only, no hints; at 960px wide the numbers truncate before the lead does.
