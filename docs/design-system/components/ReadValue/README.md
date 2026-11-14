# ReadValue

A field's value in read mode: a record page (bean, profile, roaster) before Edit. NumberField, TextField and SelectField show it when `readOnly`; Edit swaps it for the field in the same place in the card.

## Anatomy

- **Label** above, `label` style in `ink-muted`, 2px over the value.
- **Value**: `body` in `ink`, one line, truncated at its end; numbers tabular. With a unit: "240 °C". Empty: "–". Compact, so a card of values reads at a glance; in a table it keeps a field's 44px row so rows line up with Edit's.
- **Hint**: one `label` line under it, as the field's.

## Rules

- No box, border or fill: it reads as text, not as a disabled field.
- In a table (`hideLabel`) the label is for screen readers only and the text lines up with the column's heading.
- The value is named by its label (`aria-labelledby`).
