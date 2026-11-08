# RoastList

The list of saved roasts on the History screen: one row per roast, newest first, one selected.

## Anatomy

- **Card**: `surface` fill, `radius-xl`; rows separated by 1px `border` rules, no outer border. Scrolls inside its own area; the screen never scrolls.
- **Row**: a full-width button, at least `control-sm` (44px) tall, 12px × 16px padding.
  - **Title**: date and time, `body` semibold in `ink` (`Wed 4 Nov · 14:32`).
  - **Numbers**: one line of `label` in `ink-muted`, tabular: total time, first crack, drop temperature (`9:40 · FC 8:00 · 205.5 °C`).
  - **Badge** (optional, at the end of the title line, so the numbers keep the full width): neutral `UNFINISHED` for a roast whose cooling never ended, `IN PROGRESS` for the one being roasted now.

## States

- **Hover**: `surface-hover`.
- **Selected**: `surface-raised` fill, as in NavList; `aria-current` on the row.
- **Focus**: 2px `focus` ring, inset so it isn't clipped by the scroll area.
- **Select mode** (History ⋯ → Select): each row is a checkbox (`role="checkbox"`), with a 20px box before the title: `border-strong` outline, ticked `heat-tint` with a `heat` check; a ticked row is `surface-raised`. Shift-click ticks the range from the last one. Over the list a bar says "3 selected" on its own line, with Export ▾ (Roastpilot file, CSV) and Done under it (Done at the end), so it fits the 256px sidebar; clicking a row ticks it instead of opening it until Done.

## Rules

- Numbers before words; a missing number is left out, never shown as a dash in the row.
- Up and Down arrows move through rows like Tab does; the list has an accessible name.
