# TextAreaField

A labelled multi-line text field that grows with its text: a roast's notes.

## Anatomy

- **Label** above, `label` style in `ink-muted`, as on TextField.
- **Field**: at least `control-sm` (44px) tall, growing a line at a time with what's typed (CSS `field-sizing: content`), up to 192px, then it scrolls inside. `surface` fill, 1px `border`, `radius-md`, `body` text in `ink`, 10px × 14px padding; no resize handle.

## States

- **Hover**: `border-strong`. **Focus**: 2px `focus` ring, 2px offset. **Disabled**: 50% opacity.

## Rules

- A real `<textarea>` with a `<label>`; Enter adds a line, it never submits.
- For text that can run to a few lines (notes); a name or a search is a TextField.
