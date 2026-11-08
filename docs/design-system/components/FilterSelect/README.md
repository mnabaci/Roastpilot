# FilterSelect

A compact filter chip in a sidebar or a header: "Bean ▾", "Profile ▾", "Compare ▾".

## Anatomy

- **Chip**: `control-sm` tall, `radius-md`, 10px side padding (`px-2.5`), `label` text at 600, a 16px ChevronDown 4px (`space-1`) after it. Menu's worded trigger is the same chip, so "Compare ▾" and "Make profile ▾" match side by side.
- **Text**: its name while it doesn't filter ("Bean"), the choice while it does ("Ethiopia Guji"); the full "Bean: Ethiopia Guji" is its tooltip and its screen-reader name and value.
- **Quiet**: `surface-raised`, `ink` text; hover `surface-hover`. **Filtering**: `heat-tint` fill, `heat` text, so a filtered list is never a mystery.

## Rules

- The chip is a button opening the Select panel; its first option is the "All" that clears the filter.
- Filters sit in one row under the title: ★ (favourites only) first, then the chips; they share the row's width and never wrap a chip's text.
