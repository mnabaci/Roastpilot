---
name: design-sync
description: Regenerate the claude.ai design-system page from the repo after a merge that changed packages/ui/tokens.json or docs/design-system. Use when a maintainer asks to sync the design system, or after such a merge.
---

# Design sync

The repo is the design system's source of truth (ADR 0020, `docs/adr/0020-design-system-in-the-repo.md`). The claude.ai page is a read-only view of it: never edit it by hand.

| Part        | Source in the repo                                  |
| ----------- | --------------------------------------------------- |
| Tokens      | `packages/ui/tokens.json`                           |
| Brand book  | `docs/design-system/README.md`                      |
| Guidelines  | `docs/design-system/components/<Name>/README.md`    |
| Previews    | `docs/design-system/components/<Name>/preview.html` |
| Live states | Storybook (`pnpm storybook`)                        |

## In a PR (any agent)

1. Change tokens in `packages/ui/tokens.json`, then run `pnpm --filter @roastpilot/ui tokens` to regenerate `src/styles/tokens.css` and `src/styles/theme.css`. Never edit the generated CSS.
2. If token names were added or removed, update `src/styles/globals.css` mappings and search the code for removed names.
3. Update the guidelines and preview of every component the change touches (`add-component`).
4. `pnpm check`.

## After the merge (a maintainer with a Claude session)

1. On an up-to-date `main`, run `/design-sync`: it regenerates the claude.ai page from the sources above.
2. Open the page and check the changed components and tokens in both themes.
