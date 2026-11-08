# SegmentedControl

One choice from a short, fixed set, applied at once: Cool the beans for (2–6 min), Cool the drum to, Soak time, smoothing.

## Anatomy

- **Track**: `surface-raised`, `radius-md`, 4px padding, segments side by side; wraps onto a second line rather than scrolling.
- **Segment**: drawn `control-sm` (44px) tall minus the padding, with its hit area reaching into the track's padding so it is still a full 44px target, 12px side padding, `label`-sized 15px/600 text in `ink-muted`, value then unit (`4 min`, `50 °C`, `1:00`).
- **Chosen**: `heat-tint` fill and `heat` text, the Button toggle look; one is always chosen.

## States

- **Hover**: `surface-hover` behind an unchosen segment, text `ink`.
- **Focus**: 2px `focus` ring on the segment, inset.
- **Disabled**: the whole control at 50%.

## Rules

- `role="radiogroup"` named by its setting; segments are `role="radio"` with `aria-checked`. Left / Right (and Up / Down) move the choice; only the chosen segment is in the Tab order.
- Two to six options. More, or options that need words, use SelectField.
- On / off uses Switch, not two segments.
