---
name: engineering-standards
description: The Roastpilot coding checklist. Use before writing or changing any code in this repo, and whenever unsure how something should be structured.
---

# Engineering standards

Read this before touching code. It is the checklist `code-review` holds you to.

## 1. Know where the change belongs

- Read the relevant `docs/spec/*.md`. If behaviour changes, update the spec first (`plan-feature`).
- Find the package by its job (root `CLAUDE.md` boundaries table) and read that package's `CLAUDE.md`.
- Variation (new roaster, rule, layer, exporter)? It is an extension point: use `add-extension`.

## 2. Design

- One responsibility per module and per function. A file over ~200 lines or a function over ~40 is a smell.
- Depend on interfaces from `core`, receive dependencies through constructors or parameters.
- Inject time (`Clock`) and I/O; `core` stays pure.
- Prefer data + small functions over class hierarchies. No base classes "for later".
- No speculative options, flags or abstractions: add an extension point only when a second implementation is planned.
- Names say what, not how: `DropTempEndRule`, not `Rule2`.

## 3. Types and errors

- `strict` TypeScript; no `any`, no non-null `!` without a comment saying why it is safe.
- Validate data at boundaries (IPC with zod, serial lines in the driver, DB rows in repositories).
- Errors: return typed results for expected failures; throw only for programmer errors.
- Anything that can leave the heater on ends in `safeStop()`.

## 4. UI

- Build from `@roastpilot/ui` components; new ones via `add-component`.
- Tokens only: Tailwind token classes (`bg-surface`, `text-ink-muted`) or CSS variables. No hex, no arbitrary sizes.
- One primary action per state, numbers before sentences, one-line hints, no modals during a roast.
- Accessible: real `<button>`/`<input>` + `<label>`, focus ring, 44px targets.

## 5. Tests

- Vitest, next to the code: `thing.ts` + `thing.test.ts`.
- Every rule, controller, state transition and safety condition has a test, using `SimulatedDriver` and a fake clock.
- Test behaviour through public APIs, not private details.

## 6. Finish

- `pnpm check` passes.
- Spec and ADRs updated; skills updated if a workflow changed.
- Conventional commit on a branch; PR uses the template.
