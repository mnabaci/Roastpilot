---
name: design-review
description: Review a Roastpilot screen or component against the design system and UX rules. Use after UI changes.
---

# Design review

1. **Tokens:** colours, radii, spacing and type from tokens only; no hex or arbitrary values.
2. **Hierarchy:** one primary action per state, using the primary button; everything else tonal or ghost.
3. **No walls of text:** numbers before sentences; hints are one line; no modals during a roast.
4. **Readability:** live values use the readout styles with tabular numerals; readable from 1–2 m.
5. **Colour meaning:** ember = heat, cyan = air, grey = reference, state colours only for real states, red only for safety.
6. **Accessibility:** 4.5:1 text contrast in dark and light, focus ring visible, 44px targets, labels on inputs, `aria-label` on icon-only buttons.
7. **Copy:** sentence case, value then unit (`212 °C`, `1:58`), verbs on buttons.
8. **Layout:** the top bar and safety banners never scroll; each screen scrolls inside its own area (on Logs only the list). Run the app (`run` skill) at the minimum window size (960 × 640) and at full screen and open every screen: no page-level scrolling, no horizontal scroll, nothing clipped (big numbers fit their cards, long text truncates). Measure, don't eyeball: `document.documentElement.scrollWidth === clientWidth` and `scrollHeight === clientHeight`.
9. Check both themes in Storybook (`pnpm storybook`, theme switch in the toolbar) and the a11y panel. List issues with the exact fix.
