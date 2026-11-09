# Tooltip

The whole of a line that had to truncate (a History row's bean · how it ran · rating), shown when you rest the pointer on it or tab to it. Never the system's `title`: that one ignores the theme and the type.

## Anatomy

- **Panel**: `surface-raised` fill, 1px `border-strong`, `radius-md`, 6px × 12px padding, at most 320px wide (longer text wraps).
- **Text**: `label` style in `ink`.
- **Place**: under its trigger, 4px away, lined up with its left edge; it flips above, or shifts sideways, to stay 8px inside the window.

## Behaviour

- Opens 500 ms after the pointer rests on the trigger, or after focus lands on it from the keyboard; a click focusing it doesn't open it.
- Closes at once when the pointer leaves, focus moves on, Escape is pressed or the trigger is clicked.
- Never takes focus and lets the pointer pass through: it only reads.

## Rules

- The trigger is one focusable element (a row's button); while open, its `aria-describedby` points at the tooltip (`role="tooltip"`).
- Text only, one short line where it can: the full form of what's on screen, never new information or actions.
- Follows the theme like every panel; no arrow, no shadow (the same look as the dropdown panel).
