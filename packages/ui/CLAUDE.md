# packages/ui

Design-system React components (shadcn/ui based), tokens.json and the generated CSS variables and Tailwind preset.

May import: `shared`.

## Rules

- Colours, spacing, radii and type come from `tokens.json` only. No hex values in components (ESLint enforces it).
- `tokens.json` is synced from the Roastpilot design system with the `sync-tokens` skill; never edit it by hand.
- Components are presentational: props in, events out. No IPC, no stores.
- Accessible by default: real buttons and inputs, labels, focus ring, 44px minimum targets, 4.5:1 text contrast.
- Follow the brand book: one primary action per state, numbers before sentences, no walls of text.
