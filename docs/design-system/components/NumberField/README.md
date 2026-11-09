# NumberField

A short labelled input for a number or an `m:ss` time, in tables and rows of values: Charge temp, a step's duration, a batch weight.

## Anatomy

- **Label** above, `label` style in `ink-muted`; in a table whose column header names it (`hideLabel`), read by screen readers only.
- **Field**: a text input (`inputmode="decimal"`, so it takes `4:05` as well as `180`), `control-sm` (44px) tall, `surface` fill, 1px `border`, `radius-md`, 10px side padding, `body` in `ink`, tabular numerals.
- **Unit** (optional): inside the field at the right, 10px from the edge, `label` in `ink-muted` (`°C`, `°F`, `g`, `%`); the text keeps clear of it. Hidden from screen readers: the label names the unit. A temperature field shows the unit chosen in Settings, and the screen converts what is typed.
- **Hint** (optional): one line of `label` under the field, `ink-muted` ("At most 400 g on Skywalker"); `critical-text` when invalid.

## States

- **Hover**: `border-strong`.
- **Focus**: 2px `focus` ring, 2px offset.
- **Invalid**: `critical-text` border and hint, `aria-invalid`; the hint is the field's description.
- **Disabled**: 50% opacity, `not-allowed` cursor.
- **Read** (`readOnly`): no field, the value as text (`body`, `ink`, tabular) with its unit (`240 °C`), or `–` when empty, on a line as tall as the field so a read page and its edit form line up; the label stays above and names it. Pages in read mode (a bean, a profile, a roaster) use it.

## Rules

- It keeps the text as typed, so a half-typed `4:` stays until the form checks it; the form, not the field, parses and says what is wrong in the hint.
- Checked as you type, never with a dialog; a wrong value isn't saved.
- A choice of numbers from a fixed list in the same row (a time, a temperature) is a SelectField with `numeric`, so its value lines up with these fields.
