# Switch

An on / off setting that applies at once: Find the charge point, Cool the drum after each roast, Bean cooler helps cool the drum.

## Anatomy

- **Track**: 44 × 26px, `radius-full`. Off: `border-strong`. On: `heat-tint` with a 1px `heat` inset ring.
- **Thumb**: 20px circle, 3px inside the track. Off: `ink-muted`, at the start. On: `heat`, at the end. Slides in 120ms.
- **Hit area**: the whole button, at least `control-sm` (44px) tall.

## States

- **Hover**: track one step lighter (`surface-hover` when off).
- **Focus**: 2px `focus` ring, 2px offset, around the track.
- **Disabled**: 50% opacity, `not-allowed` cursor.

## Rules

- A real `<button role="switch" aria-checked>` named by its setting; never a checkbox styled as a switch.
- No On / Off text inside; the setting's name says what it does.
- Only for on / off. Two or more named choices use SegmentedControl.
