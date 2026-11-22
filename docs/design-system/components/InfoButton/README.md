# InfoButton

A small ⓘ beside a name, for what its one-line hint can't say: Settings' AI helpers (what each helper does, where you use it, what it sends).

## Anatomy

- **Button:** 24px, round, a 16px Lucide `Info` in `ink-muted`; hover, focus or open `ink`. 4px after the name, on its line.
- **Panel:** the dropdown panel (`surface-raised`, `border-strong`, `radius-lg`), 384px wide, 12px × 16px padding, under the button, aligned to its start. A few short paragraphs in `label`, 8px apart: the first says what it is, in `ink`; the rest (where, what it sends) in `ink-muted`.

## Rules

- Opens on click, Enter or Space, not on hover; stays open while you read; Escape or a click away closes it and focus goes back to the button.
- Named by what it explains ("About tasting words"); the panel has the same name.
- Not a Tooltip: a Tooltip only shows the whole of a cut-off line. Not for anything you need to use the row: that belongs in the hint.
- At most three short paragraphs. Longer belongs in the docs.
