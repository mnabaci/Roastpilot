# Menu

The actions you rarely need, behind a "⋯" button, so the one main action stands alone.

## Anatomy

- **Trigger**: a ghost icon button (Lucide Ellipsis), `control-sm`, named for screen readers ("More for Light · Steps"). Or, when the menu is one action with a choice, a worded chip with a ChevronDown after the word ("Make profile ▾" → Step profile, Curve profile), drawn exactly like FilterSelect's chip.
- **List**: the Select panel (`surface-raised`, 1px `border-strong`, `radius-lg`, 4px padding), at least 192px wide, aligned to the trigger's end, 4px below it.
- **Item**: `control-sm` tall, 12px side padding, `body` in `ink`; an optional 20px icon first. Delete is `critical-text`, never a red fill.

## States

- **Highlighted** (hover or arrow keys): `surface-hover`. **Disabled**: 50%.

## Rules

- Arrows move, Enter picks, Escape closes; focus goes back to the trigger.
- Built on Radix DropdownMenu (ADR 0012); app code uses the wrapper only.
- Never put the main action in the menu.
