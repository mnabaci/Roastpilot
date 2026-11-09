# Tooltip

The whole of a line that had to truncate (a History row's bean · how it ran, a sidebar name, a filter chip's choice), what a tab's status dot means, or why a disabled action waits (a "⋯" item, Roasters' Connect and Edit: "Disconnect first"), shown when you rest the pointer on it or tab to it. The app's only tooltip: never the system's `title`, which ignores the theme and the type.

## Anatomy

- **Panel**: `surface-raised` fill, 1px `border-strong`, `radius-md`, 6px × 12px padding, at most 384px wide (longer text wraps).
- **Text**: `label` style in `ink`.
- **Place**: under its trigger, 4px away, lined up with its left edge; it flips above, or shifts sideways, to stay 8px inside the window. `side="left"` opens it beside the trigger, centred (a menu item's reason). `fitTrigger` keeps it no wider than its trigger, wrapping (a list row's whole line).

## Behaviour

- Opens 500 ms after the pointer rests on the trigger, or after focus lands on it from the keyboard; a click focusing it doesn't open it.
- Closes at once when the pointer leaves, focus moves on, Escape is pressed or the trigger is clicked.
- Never takes focus and lets the pointer pass through: it only reads.

## Rules

- The trigger is one focusable element (a row's button); while open, its `aria-describedby` points at the tooltip (`role="tooltip"`).
- Text only, one short line where it can: the full form of what's on screen, or the reason a dimmed action waits; never actions.
- Follows the theme like every panel; no arrow, no shadow (the same look as the dropdown panel).
