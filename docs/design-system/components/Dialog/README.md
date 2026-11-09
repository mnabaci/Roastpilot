# Dialog

A small window over the screen for a tool you use and close, without leaving where you are: Beans' Batch calculator. Asking before something that can't be undone is ConfirmDialog's job, not this one's.

## Anatomy

- **Overlay**: `bg` at 70%, as ConfirmDialog.
- **Dialog**: centred, at most 560px wide and 16px inside the window on every side, `surface`, 1px `border-strong`, `radius-xl`, `space-5` padding, `space-5` between its parts. Taller content scrolls inside it; the page behind never moves.
- **Header**: the title (`heading`, `ink`), an optional one-line description under it (`label`, `ink-muted`), and at its right an icon-only Close (ghost `sm`, Lucide `X`, 44px, `aria-label` "Close").
- **Content**: whatever the tool is, laid out as on a page.

## Behaviour

- Opens only from your own click (a "⋯" item, a button). Escape, Close or a click on the overlay closes it; focus moves into it as it opens and goes back to what opened it.
- It keeps nothing of its own: the screen holds its state, so reopening shows what you left (the calculator's order weight).

## Rules

- `role="dialog"`, named by its title, described by its description.
- One task per dialog; no Save. A tool that changes a record belongs on the record's page.
- No arrow, no shadow; the same look as ConfirmDialog.
