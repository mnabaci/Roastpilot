Roastpilot rules (full list: AGENTS.md and the engineering-standards skill):

1. Load the engineering-standards skill before writing or changing code; start features with plan-feature.
2. Spec in docs/spec is the source of truth: change it first.
3. Package boundaries: shared <- core <- drivers/storage; ui <- shared; only apps/desktop uses Electron.
4. core is pure TypeScript: no Electron, no Node I/O, inject time.
5. Extend by implementing an extension point and registering it; never grow a switch.
6. UI uses design tokens only (no hex); components from @roastpilot/ui; one primary action per state.
7. UX: numbers before sentences, one-line hints, no pop-ups during a roast (except a confirmation dialog the user opened).
8. SOLID, KISS, DRY; small files; no speculative abstractions.
9. Every rule and state transition has a test; safety paths end in safeStop().
10. Run pnpm check before committing; conventional commits on a branch, never push to main.
