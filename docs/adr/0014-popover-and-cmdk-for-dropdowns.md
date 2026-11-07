# 0014: Radix Popover and cmdk for dropdowns

Status: accepted
Date: 2026-11-07

## Context

Fields (Bean, Profile, Ghost, Process, Model) and filter chips used the native `<select>`, so they opened the system popup: it ignores the design tokens, can't show a detail line under an option, and can't search. The "⋯" menus already use Radix (ADR 0012) and look like the app. The user asked for one good-looking, easy dropdown everywhere, with a search box on long lists (Ghost grows with every roast) and a detail line per option.

Radix Select has no room for a search box. Building a listbox with search by hand means getting combobox roles, active-descendant focus, typeahead and scrolling right ourselves.

## Decision

Add `@radix-ui/react-popover` and `cmdk` to `packages/ui`, the pairing shadcn/ui uses for its Combobox. Wrap them as one `Select` (a field or a filter chip as its trigger), styled with tokens only, with the same panel and row styles shared by `Menu`. App code uses the wrappers, never Radix or cmdk directly. `SelectField` and `FilterSelect` become thin triggers over `Select`; the native `<select>` goes.

## Consequences

- One panel and one keyboard model for every dropdown; search and detail lines come for free.
- Two more runtime dependencies to keep updated (Dependabot covers them).
- The native select's built-in behaviours (system typeahead, the macOS wheel) are replaced by ours and tested in `Select`'s tests.
