# ErrorState

What shows instead of a screen that failed to draw, so the window never goes blank.

## Anatomy

- Centred in the space it replaces, at most 480px wide, `space-4` between parts.
- **Icon**: Lucide TriangleAlert, 32px, `warning`.
- **Title**: `heading`, what broke: "Settings hit a problem".
- **Detail**: one line of `body` in `ink-muted`, the error's own message, truncated; the whole of it shows in a `Tooltip`, and in the log.
- **Actions**: Reload (primary, `control-md`, RotateCw icon) and Open log folder (ghost).
- **Whole window** (the app frame itself failed): the same on `bg`, with Emergency stop (danger) above Reload whenever a roaster is connected, because the top bar is gone.

## Rules

- Not `critical`: red stays for safety. A drawing error never stops the roast; the roast keeps running in the background and Reload only redraws the window.
- Never a modal. One line of text, no stack trace on screen.
- The screen's own error shows inside its area; the top bar, safety banners and Emergency stop stay.
