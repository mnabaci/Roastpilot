---
name: code-review
description: Review a Roastpilot code change against the project's principles, boundaries and tests. Use before opening or merging a PR.
---

# Code review

Review the diff (`git diff main...HEAD`) against `engineering-standards`. Report findings by severity, each with file:line and a concrete fix.

1. **Correctness and safety:** heater can never be left on; errors handled at boundaries; watchdog kept alive.
2. **Boundaries:** imports follow the package table; `core` pure; Electron only in `apps/desktop`.
3. **Design:** single responsibility, interfaces not concretions, extension points used instead of switches, no speculative abstractions, no duplication.
4. **Types:** no `any`, no unexplained `!`, zod at IPC boundaries.
5. **Errors and logging:** no hidden errors (empty `catch`, unhandled promise); every failure path returns a typed error or is logged with context; edge cases tested; nothing logged through `console`.
6. **Tests:** every new rule, branch and state transition covered; tests use public APIs and a fake clock.
7. **Docs:** spec, ADRs and skills updated when behaviour or workflow changed.
8. **Touched files comply:** every file in the diff follows the rules and skills as a whole, not just the changed lines. A violation left in a touched file is a finding.
9. Run `pnpm check` and include the result.
