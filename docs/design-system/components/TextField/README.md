# TextField

A labelled single-line text input, for search and short entries (log search, bean name, an API key).

## Anatomy

- **Label** above, `label` style in `ink-muted`; always visible, never a placeholder in its place.
- **Field**: `control-sm` (44px) tall, `surface` fill, 1px `border`, `radius-md`, `body` text in `ink`, 14px side padding. Placeholder in `ink-muted`.
- **Search** type shows a Lucide Search icon (20px, `ink-muted`) at the left, and a Clear button (ghost, X icon, labelled "Clear") at the right while there is text.
- **Password** type shows dots instead of what you type: an API key in Settings › AI helpers. Nothing else changes.

## States

- **Hover**: `border-strong`.
- **Focus**: 2px `focus` ring, 2px offset; border stays.
- **Disabled**: 50% opacity, `not-allowed` cursor.

## Rules

- A real `<input>` with a `<label>`; Escape clears a search field.
- A password field never shows its value again once saved: the screen shows "Saved · ends 4f2a" instead.
- Filters as you type; no Search button.
