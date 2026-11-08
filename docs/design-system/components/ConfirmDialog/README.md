# ConfirmDialog

Asks once before something that can't be undone or ends something: Delete, Clear, Stop roast, Stop preheat, Stop.

## Anatomy

- **Overlay**: `bg` at 70%.
- **Dialog**: centred, at most 400px wide, `surface`, 1px `border-strong`, `radius-xl`, `space-5` padding.
- **Icon** (optional `icon`): a Lucide icon before the title, 20px, 2px stroke, in the tone's colour (`warning` for caution, `critical-text` for destructive).
- **Question**: `heading` ("Delete this roast?"); **what happens**: one line of `body` in `ink-muted` ("can't be undone").
- **Consequences** (optional `consequences`, up to 3): short lines under the question, `body` in `ink-muted`, one line each, sentence case, what happens now ("Heater, fan and drum off now"). When present they replace the single detail line.
- **Answers**, right-aligned: the cancel button (ghost, `cancelLabel`, default "Cancel"), then the verb (secondary). An optional second answer sits before the verb ("Keep deducted" beside "Return to stock").

## Tones

- **Destructive** (default): the verb and icon in `critical-text`, text only. For deleting.
- **Caution**: the verb and icon in `warning` (amber), text only, never a fill. For a normal stop that ends something but is not an emergency: Stop roast.
- Red fill (`critical`) stays only for Emergency stop, so a red block always means safety.

## Copy

- `cancelLabel`: for a stop, the keep-going verb ("Keep roasting"); otherwise "Cancel".
- Consequences say what happens now, not what might: "No bean cooling · dump the beans yourself". At most 3, one line each, no full stops.
- The verb names the action ("Stop roast", "Delete"), never "OK" or "Yes".

## Stop roast and Stop preheat

Opened by the normal stop button at the bottom of the Roast screen's flow panel: full width, set apart by a thin `border` divider, Lucide `CircleStop` icon, `warning` text on the secondary grey button. A normal stop must be easy to find but never look like the red Emergency stop.

- Icon `CircleStop`; the words follow the phase.
- Preheat: "Stop preheat" opens "Stop the preheat?" · "Heater, fan, drum and filter off now" · "Back to Ready · nothing is saved", buttons "Keep preheating" / "Stop preheat" (caution).
- Roasting and Development: "Stop roast" opens "Stop the roast?" · "Heater, fan, drum and filter off now" · "No bean cooling · dump the beans yourself" · "The roast is saved as stopped", buttons "Keep roasting" / "Stop roast" (caution).

## Do / don't

- Do use caution amber for a stop and destructive red text for a delete.
- Don't fill the verb in amber or red; don't use `critical` outside Emergency stop.
- Don't write more than 3 consequences or wrap one onto two lines; cut words instead.

## Rules

- Opens only from the user's own click; never for alerts, which stay banners.
- Focus always starts on the cancel button, so Enter never confirms by accident; Escape closes it.
- Icons are decorative (`aria-hidden`); the dialog is an `alertdialog` labelled by its question, and consequences are its description.
- `warning` on `surface` meets 4.5:1 in both themes (#ffc23d dark, #8a5a00 light).
- Built on Radix AlertDialog (ADR 0012).
