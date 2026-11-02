---
name: sync-tokens
description: Pull design tokens from the Roastpilot design system into packages/ui and regenerate CSS. Use when colours, type, spacing or radii change in the design system.
---

# Sync design tokens

The design system is the source of truth (ADR 0005). Link: `docs/spec/ui.md`.

1. Get the design system's `project/tokens.json` (ask the user to export it, or read it with an artifacts tool if available).
2. Replace `packages/ui/tokens.json` with it, unchanged.
3. Run `pnpm --filter @roastpilot/ui tokens` to regenerate `src/styles/tokens.css` and `src/styles/theme.css`.
4. If token names were added or removed, update `src/styles/globals.css` mappings and search the code for removed names.
5. `pnpm check`, then commit as `chore(ui): sync design tokens`.
