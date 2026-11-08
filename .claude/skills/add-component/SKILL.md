---
name: add-component
description: Add or change a Roastpilot UI component in packages/ui, keeping the design system in step. Use when a screen needs a reusable piece of UI, or an existing component's look, sizes or rules change.
---

# Add or change a UI component

1. Read the component's guidelines in `docs/design-system/components/<Name>/README.md` and the brand book `docs/design-system/README.md` (the design system lives in the repo, ADR 0020). A new component gets its guidelines file first; if a choice is unclear, ask the user, with a recommendation.
2. Prefer a shadcn/ui base: `pnpm dlx shadcn@latest add <name>` from `packages/ui` (aliases are in `components.json`), then restyle with tokens.
3. File: `packages/ui/src/components/<Name>.tsx`, one component (plus small private parts) per file. Export it from `packages/ui/src/index.ts`.
4. Props in, events out. No IPC, no stores, no data fetching.
5. Styling: Tailwind token classes and `cn()` only; variants with `class-variance-authority`. No hex, no arbitrary values.
6. Accessibility: semantic elements, labels, `aria-*` where needed, focus ring, 44px targets, 4.5:1 contrast in both themes.
7. Copy follows the brand book: sentence case, value then unit (`212 °C`), one-line hints.
8. Test behaviour (renders states, fires events) in `<Name>.test.tsx`.
9. Add `<Name>.stories.tsx` with a story per variant and state; check both themes and the a11y panel in `pnpm storybook`.
10. **Design system in step:** a new component, or a change to one's look, sizes or rules, updates `docs/design-system/components/<Name>/README.md` (and `docs/design-system/README.md` for screen-wide rules) in the same PR. Storybook is the live preview. Never edit the claude.ai design-system page by hand: a maintainer re-syncs it with `/design-sync`.
11. Run `design-review`.
