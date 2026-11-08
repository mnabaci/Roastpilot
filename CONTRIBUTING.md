# Contributing to Roastpilot

Thanks for helping. Bug reports, roaster drivers, fixes and docs are all welcome. Small, focused
pull requests get reviewed fastest.

## Setup

- **Node:** 24 LTS (`.nvmrc`); 22.22+ works (`engines` in `package.json`). Node runs our `.ts`
  scripts directly.
- **pnpm:** 10 (`packageManager` pins the exact version; `corepack enable` picks it up).
- macOS or Windows. Linux works for development and CI, but isn't a release target.

```sh
pnpm install
pnpm dev        # run the app; rebuilds native modules for Electron first
```

No roaster? Connect the **Simulator** on the Roasters screen.

## Commands

```sh
pnpm check          # format check, lint, typecheck, test: run before every commit
pnpm test:watch     # tests in watch mode
pnpm test:coverage  # tests with coverage
pnpm storybook      # component workshop at http://localhost:6006
pnpm --filter @roastpilot/ui tokens   # regenerate CSS from tokens.json
```

CI runs the same checks, plus the build, on Ubuntu and Windows for every pull request.

## How work flows

1. **Spec first.** Behaviour lives in [`docs/spec`](docs/spec/README.md). Change the spec in the
   same PR as the code, ideally as its own `docs(spec):` commit first.
2. **ADR for hard-to-reverse choices** (a library, a file format, a protocol): add one in
   [`docs/adr`](docs/adr/README.md) from `template.md`.
3. **Branch** from `main` as `feat/…`, `fix/…`, `docs/…` or `chore/…`.
4. **Conventional commits** (`feat(core): …`, `fix(desktop): …`), lowercase, checked by commitlint
   on commit.
5. **Small PRs.** Stacked PRs are welcome: branch from the PR below and target it as the base.
6. Fill in the PR template's checklist.

For anything bigger than a fix, open an issue first so we can agree on the shape.

## Code rules

The short version is in [AGENTS.md](AGENTS.md); the full checklist is the
[`engineering-standards`](.claude/skills/engineering-standards/SKILL.md) skill. In brief:

- TypeScript everywhere, `strict`; no new `.js` files.
- Small single-purpose modules, dependencies passed in, no speculative abstractions.
- Package boundaries (enforced by ESLint): `core` is pure TypeScript, only `apps/desktop` uses
  Electron. See [repository.md](docs/spec/repository.md).
- Expected failures are typed `Result`s; no empty `catch`; log through the injected `Logger`,
  never `console` ([errors-and-logging.md](docs/spec/errors-and-logging.md)).
- Cross-platform: paths via `node:path`, no shell-only scripts.

## Safety rules

Roastpilot drives a heater. These are not negotiable:

- Any path that can leave the heater on ends in `safeStop()`.
- Every safety rule and every change to safety code has tests (Simulator plus fake clock).
- Never weaken a safety limit or rule ([safety.md](docs/spec/safety.md)) without an ADR saying why.
- Found a way the heater can stay on? Report it privately, as [SECURITY.md](SECURITY.md) says.

## Adding a roaster

Roaster drivers are extension points: a new `RoasterDriver` (and a `Transport` if it needs one),
registered at startup, with no changes to `core`. Read
[extensibility.md](docs/spec/extensibility.md) and follow the
[`add-extension`](.claude/skills/add-extension/SKILL.md) skill. Firmware or protocol changes go
through [`firmware-change`](.claude/skills/firmware-change/SKILL.md). Not ready to write it?
Open a "New roaster" issue with the protocol details.

## UI rules

- Build from `@roastpilot/ui`; new components via the
  [`add-component`](.claude/skills/add-component/SKILL.md) skill.
- Design tokens only: no hex colours or magic sizes. Tokens come from the design system linked in
  [ui.md](docs/spec/ui.md), synced into `packages/ui/tokens.json`.
- One obvious next action per state, numbers before sentences, one-line hints, 44 px targets.
- UI changes pass the [`design-review`](.claude/skills/design-review/SKILL.md) checklist.

## Testing

- Vitest, tests next to the code (`thing.ts` + `thing.test.ts`).
- Test behaviour through public APIs. Every rule, controller and state transition has a test.
- Use the `SimulatedDriver` for roaster behaviour and an injected fake clock (`ManualClock`) for
  time, so tests never wait or touch hardware.
- Edge cases count: timeouts, disconnects, bad input, hardware faults.

## Reporting bugs

Open a [bug report](https://github.com/mnabaci/Roastpilot/issues/new?template=bug_report.yml).
Include the app version, your OS, the roaster, steps, and a log excerpt from the **Logs** screen
(or the app menu's Open log folder). Safety bugs (heater left on, a safety rule bypassed) go to
[SECURITY.md](SECURITY.md) instead, not a public issue.

## AI assistants

[AGENTS.md](AGENTS.md), the package `AGENTS.md` files and the skills in
[`.claude/skills`](.claude/skills) keep AI coding assistants (Claude Code, Copilot, Codex, Cursor)
on the same rules as everyone else. Each `CLAUDE.md` only imports its `AGENTS.md`.
Using one is fine; you are still responsible for what you submit, and the same review applies.

## Licence

There is no CLA. By contributing you agree that your contribution is licensed under the
[GPL-3.0-or-later](LICENSE), like the rest of Roastpilot.

Please follow our [code of conduct](CODE_OF_CONDUCT.md).
