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
5. **Tests:** every new rule, branch and state transition covered; tests use public APIs and a fake clock.
6. **Docs:** spec, ADRs and skills updated when behaviour or workflow changed.
7. Run `pnpm check` and include the result.
