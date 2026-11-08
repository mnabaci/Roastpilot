# Roastpilot

Desktop app for macOS and Windows (Electron + React + TypeScript) that roasts coffee on autopilot and coaches you in
manual mode. Spec: `docs/spec/`. Decisions: `docs/adr/`. Design system tokens: `packages/ui/tokens.json`.

This file is the entry point for every coding agent (Claude Code, Copilot, Codex, Cursor, ...). Each package has its
own `AGENTS.md` with local rules: read it before changing that package.

## Before writing any code

Read `.claude/skills/engineering-standards/SKILL.md` and follow it. New features start with `plan-feature`.

## Skills: when you … read …

Claude Code runs these as skills; other agents open and follow the file. Skill `<name>` is
`.claude/skills/<name>/SKILL.md`.

| When you …                                                  | Read                    |
| ----------------------------------------------------------- | ----------------------- |
| write or change any code                                    | `engineering-standards` |
| add or change behaviour (start here, before code)           | `plan-feature`          |
| review a change, before opening or merging a PR             | `code-review`           |
| change a screen or component (review it)                    | `design-review`         |
| run, drive or screenshot the app                            | `ui-check`              |
| add or change a UI component in `packages/ui`               | `add-component`         |
| change the SQLite schema                                    | `add-migration`         |
| add a roaster, transport, rule, layer, exporter or notifier | `add-extension`         |
| change the serial protocol or the firmware                  | `firmware-change`       |
| change the controller, PID, rules or safety (test it)       | `simulate`              |
| tune PID gains from saved roasts                            | `pid-tune`              |
| change tokens, or sync the design system page after a merge | `design-sync`           |
| cut a release                                               | `release`               |

## Non-negotiables

- **UX first, no walls of text:** one obvious next action per state, numbers before sentences, one-line hints.
- **SOLID, KISS, DRY:** small single-purpose modules; depend on interfaces; no speculative abstractions.
- **Extend by adding, not editing:** new hardware, rules, layers or exporters are new implementations of an extension point (`docs/spec/extensibility.md`), registered at startup.
- **TypeScript everywhere:** app code, config files, scripts and agent hooks are `.ts` (Node 22.22+ and 24 run `.ts` directly). No new `.js` files.
- **Design tokens only:** no hex colours or magic sizes in UI code.
- **Design system in step:** changing a component's look, sizes or rules updates `docs/design-system/components/<Name>/README.md` (and the brand book `docs/design-system/README.md` for screen-wide rules) in the same PR; reviews check it. Never edit the claude.ai design-system page by hand: a maintainer re-syncs it from the repo with `/design-sync` (ADR 0020, `docs/adr/0020-design-system-in-the-repo.md`).
- **Safety first:** any path that can leave the heater on must end in `safeStop()`; safety rules are tested.
- **Roasting practice:** anything Auto or the coach does or suggests must make sense to a roaster (charge, soak, turning point, dry end, first crack, development, drop) and match `docs/spec/roast-control.md`.
- **Errors are handled, never hidden:** expected failures are typed `Result`s; only programmer errors throw. No empty `catch`, and no fire-and-forget promise without a `.catch` that logs. Every error path and edge case (timeouts, disconnects, bad input, hardware faults) has a test. See `docs/spec/errors-and-logging.md`.
- **UI tests share one environment per worker:** never `vi.mock` a module in a UI test; inject the dependency (e.g. the chart engine provider `PlotEngineProvider`) instead, and restore anything you change on globals.
- **Log what matters:** through the injected `Logger`, never `console`. Structured events with context; log every failure and state change, not every reading.
- **Fix what you find:** if a file you touch or read for a change breaks these rules or a skill's checklist, refactor it to comply in the same PR, as its own `refactor:` commit. Don't build on top of a violation.
- **Never touch the user's data:** run the app only on a throwaway data folder (`ui-check`), never the real one.
- **README screenshots stay current:** a UI change that shows in a README scene runs `pnpm screenshots` and commits the changed `docs/images/*.png` in the same PR. Never edit the PNGs by hand; change a scene in `apps/desktop/src/screenshots/` instead. Its guard test must stay green.

## Package boundaries

| Package                                | May import                                   |
| -------------------------------------- | -------------------------------------------- |
| `packages/shared`                      | nothing internal                             |
| `packages/core`                        | `shared` (pure TS: no Electron, no Node I/O) |
| `packages/drivers`, `packages/storage` | `core`, `shared`                             |
| `packages/ui`                          | `shared`                                     |
| `apps/desktop`                         | everything; the only place Electron is used  |

ESLint enforces these.

## Commands

```sh
pnpm install        # install
pnpm dev            # run the app (rebuilds native modules for Electron first)
pnpm check          # format check, lint, typecheck, test: run before every commit
pnpm test:watch     # tests in watch mode
pnpm test:coverage  # tests with coverage
pnpm storybook      # component workshop at http://localhost:6006 (dark/light switch in the toolbar)
pnpm ui <command>   # drive and screenshot the running app (ui-check skill)
pnpm storybook:app  # the app's screens on sample data at http://localhost:6008
pnpm screenshots    # regenerate the README screenshots (docs/images) in headless Chrome
pnpm --filter @roastpilot/ui tokens   # regenerate CSS from tokens.json
```

## Definition of done

- Spec updated if behaviour changed; ADR added if a hard-to-reverse choice was made.
- Tests for every rule, controller and state transition you touched.
- `pnpm check` passes.
- UI changes pass `design-review` and keep the design system in step; code passes `code-review`.

## Workflow

- Branch from `main` (`feat/…`, `fix/…`, `docs/…`), conventional commits (lowercase, checked by commitlint), open a PR with `.github/pull_request_template.md`. Never push to `main`.
- **Stacked PRs:** a change that needs an open PR branches from it and targets it as base. To pick up the base's changes, merge the base into your branch: never rebase or force-push.

## Parallel work

When several agents work at once:

- **One worktree per task:** `git worktree add ../<repo>-<task> -b <branch> <base>`, then `pnpm install` there. Never switch the branch of a checkout another task uses.
- **One app at a time:** only one app instance may use the debug port 9222. Before a UI check, check the port is free (`curl -s http://127.0.0.1:9222/json` fails); if it isn't, wait for the other check to finish.
- **Your branch only:** never push to another task's branch.

## Cross-platform

Everything must work on macOS and Windows: paths via `node:path`, no shell-only scripts, serial ports picked from a list.
