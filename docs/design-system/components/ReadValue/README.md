# ReadValue

A field's value in read mode: a record page (bean, profile, roaster) before Edit. NumberField, TextField and SelectField show it when `readOnly`; Edit swaps it for the field in the same spot, so nothing moves.

## Anatomy

- **Label** above, `label` style in `ink-muted`, as the field's.
- **Value**: `body` in `ink`, in a row `control-sm` (44px) tall where the field's box would be, truncated at its end; numbers tabular. With a unit: "240 °C". Empty: "–".
- **Hint**: one `label` line under it, as the field's.

## Rules

- No box, border or fill: it reads as text, not as a disabled field.
- In a table (`hideLabel`) the label is for screen readers only and the text lines up with the column's heading.
- The value is named by its label (`aria-labelledby`).
