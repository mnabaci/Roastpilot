# NavList

The list of things in a sidebar: profiles, beans, roasters, settings sections. One is open.

## Anatomy

- **Item**: a full-width button, `control-sm` (44px) tall, 12px side padding, `radius-md`, `body` text truncated to one line; an optional second line in `label` / `ink-muted` and an optional trailing Badge (`EDITED`, `ACTIVE`, `LOW`).
- **Gap**: 4px between items; no rules, no card.

## States

- **Open**: `surface-raised` fill and `ink` text; `aria-current="true"`. Grey, not ember: it shows where you are, not a choice that changes the roast.
- **Other items**: `ink-muted` text, `surface-hover` and `ink` on hover.
- **Focus**: 2px `focus` ring, inset so the scroll area doesn't clip it.
- **Select mode** (Profiles, Beans and Roasters ⋯ → Select): items keep `ink` text; each item is a checkbox (`role="checkbox"`) with RoastList's 20px tick box before the name; a ticked item is `surface-raised`. Shift-click ticks the range from the last one; a click ticks instead of opening until Done. The bar over the list is RoastList's: the count on its own line, the actions and Done under it. An item that can't be ticked (`locked`) is `aria-disabled` with a `not-allowed` cursor, a 16px Lucide Lock in `ink-muted` in place of its box, and its second line says why in one or two words ("Built-in", "Running now", "Active", "Archived").

## Rules

- A `<nav>` or list with an accessible name; Up and Down move between items like Tab does.
- Long names truncate; the full name is in a Tooltip on the row (hover or keyboard focus), never the system's `title`.
- Actions for the list (Add roaster, Add bean) go under the items as a ghost button, never inside an item.
