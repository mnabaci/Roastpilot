# Button

Compact, tonal buttons with an icon: one ember primary per phase, quiet tonal secondaries, a ghost for low-priority actions.

## Variants

- **Primary**: `heat-fill` with `on-heat` text and icon, 16px/600, `radius-md`. Phase actions use `control-lg` (56px) full width; elsewhere `control-md` (48px). Hover `heat-fill-hover`; pressed scales to 98%.
- **Secondary (tonal)**: `surface-raised` fill, no border, `ink` text, 15px/600. Hover `surface-hover`. Drop now, Duplicate, Export CSV.
- **Outline**: `surface-raised` fill, 1px `border-strong` border, `ink` text, 15px/600; hover `surface-hover`. For anything that closes or acknowledges: the coach's Dismiss, the finished-roast card's Done, History's select-mode Done, AlertBanner's Acknowledge. A ghost would be too easy to miss on a tint or a banner.
- **Ghost**: transparent, `ink` text (`ink-muted` read as disabled on the dark ground); hover `surface-hover`. Quieter than secondary because it has no fill, never because of dim text. Cancel in dialogs and forms, Clear, Resume auto.
- **End roast**: a secondary, full width at the bottom of the flow panel, set apart by a thin `border` divider, Lucide `CircleStop` icon and `warning` (amber) text, never red. A normal stop must be easy to find but never look like Emergency stop; red fill is only for that.
- **Danger**: `critical` fill, white text and icon. Emergency stop only.
- **Delete**: a ghost (or the confirm's secondary) with `critical-text` text and icon, never a `critical` fill. Delete always asks once, inline: "Delete this roast? · can't be undone", both buttons in `critical-text`.
- **Disabled**: 50% opacity, `not-allowed` cursor; keep the label so the user sees what comes next ("Heating to 150 °C").
- **On / off (toggle)**: a secondary with `aria-pressed`; when on, `heat-tint` fill and `heat` text. For choices and filters: Guided / Full control, log level and scope chips. Chips use `control-sm` (44px).

## Sizes

- `sm` (`control-sm`, 44px) for page-header actions next to the title, the ⋯ and filter chips; `md` (`control-md`, 48px) for form Save / Cancel; `lg` for the phase action.
- `sm` and `md` are at least as wide as they are tall, so a one-character or icon-only button (a rating 1–5) is still a square 44 / 48px target.

## Icons

Lucide, 20px, 2px stroke, left of the label with an 8px gap: Flame for Preheat, Play for Start, Sparkle for First crack, ArrowDownToLine for Drop now, OctagonX for Emergency stop.

## Rules

- A real `<button>`; never a clickable div.
- No outlines as a style, except the Outline variant for closing buttons; otherwise borders only for focus (2px `focus` ring, 2px offset).
- One primary per screen state.
- **Choice buttons** (dialogs, the coach card, an editor's Save / Discard, a form's Save / Cancel): at the right end, the quiet choice first (Cancel, Discard, Dismiss, Keep roasting) and the action last (Save, Apply, End roast), as macOS and Windows dialogs do. One alone also sits at the right.
