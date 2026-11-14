# TitleField

A page's title as a field, in Edit: the name of a bean, profile or roaster, renamed where it already is. Never a separate Name field.

## Anatomy

- **Field**: `control-sm` (44px) tall, `surface` fill, 1px `border`, `radius-md`, `title` text in `ink`, 8px side padding, pulled out by that padding so the name stays where the title was.
- **No visible label**: the page title is the label; its accessible name is "Name".
- **Placeholder** in `ink-muted`, for a new record only ("Name this bean").

## States

- **Hover**: `border-strong`.
- **Focus**: 2px `focus` ring.
- **Invalid**: `critical` border; the problem is one line under the header ("Name: Needs a name").

## Rules

- Read: the title is an `h2` in `title`. Edit: the same place becomes this field, the actions (Cancel, Save) at the header's right end.
- One for every record with a name and an Edit mode: Beans, Profiles and Roasters.
