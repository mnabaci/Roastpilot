# 0012: Radix primitives for menus and dialogs

Status: accepted
Date: 2026-11-06

## Context

The Profiles header needs a "⋯" menu, and every confirmation (Delete, Clear, End roast, Stop) moves from an inline question to a dialog. Both need focus handling that is easy to get wrong by hand: arrow keys and typeahead, Escape, returning focus to the button that opened it, trapping focus in a dialog, `aria-*` roles, and staying on screen. The design system had neither component. `packages/ui` is shadcn/ui-based, and shadcn builds these on Radix.

Dialogs also go against the earlier "no pop-ups mid-roast" principle. The user chose dialogs for every confirmation, mid-roast ones included, so the principle now allows one exception: a confirmation the user opened with their own click, closed with Escape or Cancel.

## Decision

Add `@radix-ui/react-dropdown-menu` and `@radix-ui/react-alert-dialog` to `packages/ui`, wrapped as `Menu` and `ConfirmDialog` and styled with tokens only. App code uses the wrappers, never Radix directly.

## Consequences

- Accessible keyboard and screen-reader behaviour comes from a widely used library instead of our own code.
- Two runtime dependencies to keep updated (Dependabot covers them).
- A confirmation dialog mid-roast covers the controls, Emergency stop included, until it is answered. It only opens from the user's own click and closes with Escape, so it is never a surprise; banners and alarms still never use dialogs.
