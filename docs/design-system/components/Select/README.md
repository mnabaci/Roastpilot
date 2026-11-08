# Select

Pick one of a list. The one dropdown panel of the app: fields (SelectField) and filter chips (FilterSelect) open it, and "⋯" menus (Menu) draw the same panel and rows; never the system popup.

## Anatomy

- **Trigger**: a SelectField (label above, value, ChevronDown) or a FilterSelect chip. Both are `button`s with `aria-haspopup="listbox"`.
- **Panel**: `surface-raised`, 1px `border-strong`, `radius-lg`, 4px padding, rows 2px apart; the trigger's width and at least 192px; at most 384px (about 8 rows) tall, then it scrolls (thin scrollbar). It opens 4px from the trigger, lined up with its start edge, flips above when there's no room below and keeps 8px from the window's edges.
- **Search** (lists of more than 8): a row on top with a 16px Lucide Search icon and "Search…" in `ink-muted`, `body` text, focused as the panel opens; a `border` hairline under it.
- **Option**: `control-sm` (44px) min height, 12px side padding, `radius-md`; name in `body` `ink`; an optional detail line under it in `label` `ink-muted` (then 52px tall); a 16px Check (`ink`) at the left of the chosen one, the others keep that space so names line up.
- **Badge** (optional): a neutral Badge on the detail line, after the detail, for a state that helps you choose (Profile "Needs calibration"); the name keeps the row's whole width, so it never truncates for the badge, and the badge never truncates.
- **No match**: one row "No match" in `ink-muted`.

## States

- **Highlighted** (hover or arrow keys): `surface-hover`. **Disabled option**: 50%.
- **Trigger open**: its border `border-strong`, chevron turned up.

## Rules

- Arrows move, Enter picks and closes, Escape closes; focus goes back to the trigger.
- Without search, typing a letter jumps to the first option starting with it.
- Search narrows by name and detail; Enter picks the first match.
- A state goes in a badge, not in the name or the detail, so it never truncates away: Profile "Needs calibration".
- Details say what helps you choose, never repeat the name: Bean "300 g · Ethiopia · washed", Ghost "Ethiopia Guji · ★★★★★ · FC 9:12", Profile "Built-in".
- Built on Radix Popover and cmdk (ADR 0014); app code uses Select, SelectField, FilterSelect and Menu only.
