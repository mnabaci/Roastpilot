# TextField

A labelled single-line text input, for search and short entries (log search, bean name).

## Anatomy

- **Label** above, `label` style in `ink-muted`; always visible, never a placeholder in its place.
- **Field**: `control-sm` (44px) tall, `surface` fill, 1px `border`, `radius-md`, `body` text in `ink`, 14px side padding. Placeholder in `ink-muted`.
- **Search** type shows a Lucide Search icon (20px, `ink-muted`) at the left, and a Clear button (ghost, X icon, labelled "Clear") at the right while there is text.

## States

- **Hover**: `border-strong`.
- **Focus**: 2px `focus` ring, 2px offset; border stays.
- **Disabled**: 50% opacity, `not-allowed` cursor.

## Rules

- A real `<input>` with a `<label>`; Escape clears a search field.
- Filters as you type; no Search button.
