---
name: add-component
description: Build a Roastpilot UI component in packages/ui from the design system. Use when a screen needs a reusable piece of UI.
---

# Add a UI component

1. Check the design system (link in `docs/spec/ui.md`) for the component's guidelines. If it isn't there, describe it in the design system first or ask the user.
2. Prefer a shadcn/ui base: `pnpm dlx shadcn@latest add <name>` from `packages/ui` (aliases are in `components.json`), then restyle with tokens.
3. File: `packages/ui/src/components/<Name>.tsx`, one component (plus small private parts) per file. Export it from `packages/ui/src/index.ts`.
4. Props in, events out. No IPC, no stores, no data fetching.
5. Styling: Tailwind token classes and `cn()` only; variants with `class-variance-authority`. No hex, no arbitrary values.
6. Accessibility: semantic elements, labels, `aria-*` where needed, focus ring, 44px targets, 4.5:1 contrast in both themes.
7. Copy follows the brand book: sentence case, value then unit (`212 °C`), one-line hints.
8. Test behaviour (renders states, fires events) in `<Name>.test.tsx`.
9. Add `<Name>.stories.tsx` with a story per variant and state; check both themes and the a11y panel in `pnpm storybook`.
10. Run `design-review`.
