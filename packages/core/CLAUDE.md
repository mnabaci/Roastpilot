# packages/core

Pure roasting logic: roast state machine, phase engine, PID and output controllers, end rules, profile suggestion, manual coach, safety rules, extension registries and domain events.

May import: `shared`.

## Rules

- Pure TypeScript. No Electron, no Node I/O, no network, no timers you can't inject. ESLint enforces this.
- Everything that varies is an interface plus a registry (see docs/spec/extensibility.md). Add by implementing, never by editing a switch.
- Time and randomness are injected (a `Clock`), so every rule is testable with fake time.
- Every rule, controller and state transition has a unit test. Safety rules have tests for every trip condition.
