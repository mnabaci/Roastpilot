# NavList

The list of things in a sidebar: profiles, beans, roasters, settings sections. One is open.

## Anatomy

- **Item**: a full-width button, `control-sm` (44px) tall, 12px side padding, `radius-md`, `body` text truncated to one line; an optional second line in `label` / `ink-muted` and an optional trailing Badge (`EDITED`, `ACTIVE`, `LOW`).
- **Gap**: 4px between items; no rules, no card.

## States

- **Open**: `surface-raised` fill and `ink` text; `aria-current="true"`. Grey, not ember: it shows where you are, not a choice that changes the roast.
- **Other items**: `ink-muted` text, `surface-hover` and `ink` on hover.
- **Focus**: 2px `focus` ring, inset so the scroll area doesn't clip it.
- **Select mode** (Profiles ⋯ → Select): each item is a checkbox (`role="checkbox"`) with RoastList's 20px tick box before the name; a ticked item is `surface-raised`. Shift-click ticks the range from the last one; a click ticks instead of opening until Done. An item that can't be ticked is `aria-disabled`, its box at 50%, and its second line says why in one or two words ("Built-in", "Running now").

## Rules

- A `<nav>` or list with an accessible name; Up and Down move between items like Tab does.
- Long names truncate; the full name is in the item's title.
- Actions for the list (Add roaster, Add bean) go under the items as a ghost button, never inside an item.
