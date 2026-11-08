# packages/ui

Design-system React components (shadcn/ui based), tokens.json and the generated CSS variables and Tailwind preset.

May import: `shared`.

## Rules

- Colours, spacing, radii and type come from `tokens.json` only. No hex values in components (ESLint enforces it).
- `tokens.json` is synced from the Roastpilot design system with the `sync-tokens` skill; never edit it by hand.
- Components are presentational: props in, events out. No IPC, no stores.
- Accessible by default: real buttons and inputs, labels, focus ring, 44px minimum targets, 4.5:1 text contrast.
- Follow the brand book: one primary action per state, numbers before sentences, no walls of text.
- React function components with typed props (`interface ButtonProps extends ComponentProps<'button'>`); pass `className` through `cn()`.
- Tests with Testing Library in jsdom: roles, labels and events, not class names.
- Every component has a `<Name>.stories.tsx` covering its variants and states; check it in both themes in Storybook (`pnpm storybook`). Accessibility checks run in the a11y panel.
- Type styles (`text-body`, `text-readout-xl`, ...) and control sizes (`h-control-lg`) are generated from `tokens.json`; always merge classes with `cn()`, which knows about them.
