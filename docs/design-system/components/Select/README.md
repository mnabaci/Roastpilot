# Select

Pick one of a list. The one dropdown panel of the app: fields (SelectField), filter chips (FilterSelect) and "⋯" menus (Menu) all open it, never the system popup.

## Anatomy

- **Trigger**: a SelectField (label above, value, ChevronDown) or a FilterSelect chip. Both are `button`s with `aria-haspopup="listbox"`.
- **Panel**: `surface-raised`, 1px `border-strong`, `radius-lg`, 4px padding; at least the trigger's width; up to 8 rows tall, then it scrolls (thin scrollbar). It flips above the trigger when there's no room below, 4px away.
- **Search** (lists of more than 8): a row on top with a 16px Lucide Search icon and "Search…" in `ink-muted`, `body` text, focused as the panel opens; a `border` hairline under it.
- **Option**: `control-sm` (44px) min height, 12px side padding, `radius-md`; name in `body` `ink`; an optional detail line under it in `label` `ink-muted` (then 52px tall); a 16px Check (`ink`) at the left of the chosen one, the others keep that space so names line up.
- **No match**: one row "No match" in `ink-muted`.

## States

- **Highlighted** (hover or arrow keys): `surface-hover`. **Disabled option**: 50%.
- **Trigger open**: its border `border-strong`, chevron turned up.

## Rules

- Arrows move, Enter picks and closes, Escape closes; focus goes back to the trigger.
- Without search, typing a letter jumps to the first option starting with it.
- Search narrows by name and detail; Enter picks the first match.
- Details say what helps you choose, never repeat the name: Bean "300 g · Ethiopia · washed", Ghost "Ethiopia Guji · ★★★★★ · FC 9:12", Profile "Built-in".
- Built on Radix Popover and cmdk (ADR 0014); app code uses Select, SelectField, FilterSelect and Menu only.
