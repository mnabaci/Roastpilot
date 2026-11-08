# packages/ui

Design-system React components (shadcn/ui based), tokens.json and the generated CSS variables and Tailwind preset.

May import: `shared`.

## Rules

- Colours, spacing, radii and type come from `tokens.json` only. No hex values in components (ESLint enforces it).
- `tokens.json` is the tokens' source (ADR 0020): change it in a PR, then `pnpm --filter @roastpilot/ui tokens`; never edit the generated CSS (`design-sync` skill).
- Components are presentational: props in, events out. No IPC, no stores.
- Accessible by default: real buttons and inputs, labels, focus ring, 44px minimum targets, 4.5:1 text contrast.
- Follow the brand book: one primary action per state, numbers before sentences, no walls of text.
- React function components with typed props (`interface ButtonProps extends ComponentProps<'button'>`); pass `className` through `cn()`.
- Tests with Testing Library in jsdom: roles, labels and events, not class names.
- Every component has a `<Name>.stories.tsx` covering its variants and states; check it in both themes in Storybook (`pnpm storybook`). Accessibility checks run in the a11y panel.
- Type styles (`text-body`, `text-readout-xl`, ...) and control sizes (`h-control-lg`) are generated from `tokens.json`; always merge classes with `cn()`, which knows about them.
- Changing a component's look, sizes or rules updates `docs/design-system/components/<Name>.md` in the same PR (root `AGENTS.md`, `add-component` skill, ADR 0020).
