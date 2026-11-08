# Menu

The actions you rarely need, behind a "⋯" button, so the one main action stands alone.

## Anatomy

- **Trigger**: a ghost icon button (Lucide Ellipsis), `control-sm`, named for screen readers ("More for Light · Steps"). Or, when the menu is one action with a choice, a worded chip with a ChevronDown after the word ("Make profile ▾" → Step profile, Curve profile), drawn exactly like FilterSelect's chip.
- **List**: the Select panel (`surface-raised`, 1px `border-strong`, `radius-lg`, 4px padding), at least 192px wide, aligned to the trigger's end, 4px below it.
- **Item**: at least `control-sm` tall, 12px side padding, `radius-md`, `body` in `ink`; an optional 20px icon first, 8px before the label; items 2px apart. Delete is `critical-text`, never a red fill.
- **Hint** (optional): one `label` line in `ink-muted` under the item's label, saying why a disabled item waits ("Disconnect first"). It describes the item for screen readers; the item's name stays its label. On a disabled item only the label dims; the hint stays at full `ink-muted`, so it reads.

## States

- **Highlighted** (hover or arrow keys): `surface-hover`. **Disabled**: 50%, `not-allowed` cursor.

## Rules

- Arrows move, Enter picks, Escape closes; focus goes back to the trigger.
- Built on Radix DropdownMenu (ADR 0012); app code uses the wrapper only.
- Never put the main action in the menu.
- An action not allowed right now stays in the menu, disabled, with a hint saying why; the items keep their order, so the menu never changes shape (Roasters: Use this roaster and Delete wait on the active roaster and while one is connected).
