# Popover

A small panel that opens from a button, on click: a short read of something named on the page, with at most one action. A bean's supplier card (website, email, phone, notes, Edit supplier) and InfoButton's explanation use it.

## Anatomy

- **Trigger:** any button; it gets `data-state="open"` while open, so it can show that (a turned chevron, a darker underline).
- **Panel:** the dropdown panel (`surface-raised`, `border-strong`, `radius-lg`), 320px wide with 16px padding unless the caller sizes it (InfoButton and the supplier card: 384px), 12px between its parts, under the trigger, aligned to its start, 4px away, kept 8px inside the window.
- **Supplier card:** the name (`body`, semibold) over a quiet line of the beans it supplies ("Supplies African Moon and Washed Eratoi"; three or more: "Supplies Guji and 3 more"); a hairline (`border`); one row per way to reach it, a 16px Lucide icon in `ink-muted` (Globe, Mail, Phone), its value in `body`, and a 24px Copy at the row's end that turns to a `good` tick for 1.5 s; notes in `label`, `ink-muted`, up to four lines; then one ghost action, its icon lined up with the text (Edit supplier, or Add details while it has none).

## Rules

- Opens on click, Enter or Space, never on hover. Focus goes to the panel itself, not its first button, so nothing shows a focus ring on open; Tab reaches what's in it. Escape or a click away closes it, focus back on the trigger.
- Named for screen readers by what it shows (`label`); the trigger says what opens ("Green Coffee Collective, supplier details").
- Its action closes it (`PopoverClose`), as does a link that leaves (a website).
- Not a Dialog, which holds a task and a form; not a Tooltip, which only finishes cut-off text; not a Menu, which is a list of commands.
