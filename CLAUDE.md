# Roastpilot

Desktop app for macOS and Windows (Electron + React + TypeScript) that roasts coffee on autopilot and coaches you in
manual mode. Spec: `docs/spec/`. Decisions: `docs/adr/`. Design system tokens: `packages/ui/tokens.json`.

## Before writing any code

Load the `engineering-standards` skill and follow it. New features start with `plan-feature`.

## Non-negotiables

- **UX first, no walls of text:** one obvious next action per state, numbers before sentences, one-line hints.
- **SOLID, KISS, DRY:** small single-purpose modules; depend on interfaces; no speculative abstractions.
- **Extend by adding, not editing:** new hardware, rules, layers or exporters are new implementations of an extension point (`docs/spec/extensibility.md`), registered at startup.
- **TypeScript everywhere:** app code, config files, scripts and agent hooks are `.ts` (Node 22.22+ and 24 run `.ts` directly). No new `.js` files.
- **Design tokens only:** no hex colours or magic sizes in UI code.
- **Safety first:** any path that can leave the heater on must end in `safeStop()`; safety rules are tested.

## Package boundaries

| Package                                | May import                                   |
| -------------------------------------- | -------------------------------------------- |
| `packages/shared`                      | nothing internal                             |
| `packages/core`                        | `shared` (pure TS: no Electron, no Node I/O) |
| `packages/drivers`, `packages/storage` | `core`, `shared`                             |
| `packages/ui`                          | `shared`                                     |
| `apps/desktop`                         | everything; the only place Electron is used  |

ESLint enforces these. Each package has its own `CLAUDE.md` with local rules.

## Commands

```sh
pnpm install        # install
pnpm dev            # run the app (rebuilds native modules for Electron first)
pnpm check          # format check, lint, typecheck, test: run before every commit
pnpm test:watch     # tests in watch mode
pnpm test:coverage  # tests with coverage
pnpm storybook      # component workshop at http://localhost:6006 (dark/light switch in the toolbar)
pnpm --filter @roastpilot/ui tokens   # regenerate CSS from tokens.json
```

## Definition of done

- Spec updated if behaviour changed; ADR added if a hard-to-reverse choice was made.
- Tests for every rule, controller and state transition you touched.
- `pnpm check` passes.
- UI changes pass the `design-review` skill; code passes `code-review`.

## Workflow

Branch from `main` (`feat/…`, `fix/…`), conventional commits (checked by commitlint), open a PR. Never push to `main`.

## Cross-platform

Everything must work on macOS and Windows: paths via `node:path`, no shell-only scripts, serial ports picked from a list.
