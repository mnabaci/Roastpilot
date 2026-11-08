# Mark

The Roastpilot mark: a dark coffee bean on an ember tile, leaning, its centre cut running end to end. It is the app icon (Dock, taskbar, installers) and sits at the left of the top bar with the wordmark.

## Anatomy

- **Tile**: `heat-fill`, a rounded square (corner radius a quarter of its size).
- **Bean**: `bg`, filling most of the tile, turned 40° to the left.
- **Cut**: an S-curve in `heat-fill`, a fifteenth of the size wide, from one end of the bean to the other, clipped to the bean.
- **Wordmark** (top bar only): "Roastpilot" in `heading`, `ink`, 8px after the mark.

## Sizes

- Top bar: 24px mark with the wordmark.
- App icon: the same drawing on a `surface` graphite plate on the platform's icon grid; still clear at 16px.

## Rules

- Only these colours, on any theme: `heat-fill` and `bg` (and `surface` for the app icon's plate).
- The mark is decoration in the top bar (`aria-hidden`); the wordmark is the text.
- No gradients, shadows or outlines. The app icon is drawn from these tokens by `pnpm --filter @roastpilot/desktop icon`.
