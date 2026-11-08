# SelectField

A labelled drop-down for picking one of a list: Bean, Profile, Ghost, Process, Model. It opens the Select panel.

## Anatomy

- **Label** above, `label` style in `ink-muted`; always visible.
- **Field**: a button opening the Select panel, `control-sm` (44px) tall, `surface` fill, 1px `border`, `radius-md`, `body` text in `ink`, 14px left padding; a Lucide ChevronDown (20px, `ink-muted`) at the right.

## States

- **Hover**: `border-strong`.
- **Focus**: 2px `focus` ring, 2px offset.
- **Disabled**: 50% opacity, `not-allowed` cursor.

## Rules

- A `button` named by its `<label>`, announcing its value; the panel's keyboard rules are Select's.
- The first option says what "nothing picked" means (`None`), never a blank row.
