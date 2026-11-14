---
name: design-review
description: Review a Roastpilot screen or component against the design system and UX rules. Use after UI changes.
---

# Design review

Judge a component in the full screen, not on its own: run the app (`ui-check`) and look at every screen it appears on at 960 × 640 and at 1600 × 1000, in Dark and Light. Open and look at every screenshot before calling it done. List each issue with the exact fix.

## Tokens and hierarchy

1. **Purpose:** the change still fits who Roastpilot is for and what it isn't (`docs/spec/overview.md`, `challenge` skill); nothing new to read or click mid-roast without a reason.
2. **Tokens:** colours, radii, spacing and type from tokens only; no hex or arbitrary values.
3. **Hierarchy:** one primary action per state, using the primary button; everything else tonal, outline or ghost.
4. **No walls of text:** numbers before sentences; hints are one line; no modals during a roast except the confirmation dialog after the user's own click.
5. **Readability:** live values use the readout styles with tabular numerals; readable from 1–2 m.
6. **Colour meaning:** ember = heat, cyan = air, violet (`env`) = ET, grey = reference, state colours only for real states, red only for safety.
7. **Accessibility:** 4.5:1 text contrast in dark and light, focus ring visible, 44px targets, labels on inputs, `aria-label` on icon-only buttons.
8. **Copy:** sentence case, value then unit (`212 °C`, `1:58`), verbs on buttons.

## Consistency (`docs/spec/ui.md`, [App frame](../../../docs/spec/ui.md#app-frame))

9. **Choice buttons:** at the right end, the quiet choice first (Cancel, Discard, Dismiss), the action last (Save, Apply); one alone also at the right.
10. **Closing buttons:** anything that closes or acknowledges (Dismiss, Done, Acknowledge) uses the Outline button.
11. **Headers:** actions in a page header are `sm`; the open item's title sits on the sidebar title's line, in a `control-sm` row, in the `title` type.
12. **Spacing:** `space-4` between cards, in columns and grids.
13. **Values:** right-aligned in their row, tabular numerals, lining up down a column.
14. **Design system:** a changed component's look, sizes or rules are written in `docs/design-system/components/<Name>/README.md` and drawn in its `preview.html` (screen-wide rules in `docs/design-system/README.md`) in the same PR; a new component has both (ADR 0020).

## Measure, don't eyeball

15. **Alignment:** compare `getBoundingClientRect()` of the things that should line up: left edges, text baselines, right edges. Equal to the pixel, or it's a finding. Example: `pnpm ui eval "[...document.querySelectorAll('h1')].map(e => e.getBoundingClientRect().top)"`.
16. **Layout:** the top bar and safety banners never scroll; each screen scrolls inside its own area (on Logs only the list). On every screen at both sizes: `scrollWidth === clientWidth` and `scrollHeight === clientHeight` on the page (`pnpm ui shot` prints both), nothing clipped (big numbers fit their cards, long text truncates).
17. **Storybook:** both themes (toolbar switch) and the a11y panel for each changed component.
