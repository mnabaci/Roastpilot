# SelectField

A labelled drop-down for picking one of a list: Bean, Profile, Ghost, Process, Model. It opens the Select panel.

## Anatomy

- **Label** above, `label` style in `ink-muted`; always visible.
- **Field**: a button opening the Select panel, `control-sm` (44px) tall, `surface` fill, 1px `border`, `radius-md`, `body` text in `ink`, truncated to one line, 14px left and 12px right padding; a Lucide ChevronDown (20px, `ink-muted`) at the right, turned up while the panel is open.
- **Badge**: the field shows the chosen name only, never the option's badge (in a narrow field it would squeeze the name); the list shows it, and the screen says the state beside the field when it matters (Profile: "Needs calibration · stay close.").

## States

- **Hover** and **open**: `border-strong`.
- **Focus**: 2px `focus` ring, 2px offset.
- **Disabled**: 50% opacity, `not-allowed` cursor.

## Rules

- A `button` named by its `<label>`, announcing its value; the panel's keyboard rules are Select's.
- The first option says what "nothing picked" means (`None`), never a blank row.
- **Numeric** (`numeric`): for numbers (times, temperatures) in a row of NumberFields. Tabular numerals and NumberField's 10px left padding (8px right, 4px before the chevron), so its value lines up with theirs.
- **Hidden label** (`hideLabel`): in a table whose column header already names it, the label is read by screen readers only.
