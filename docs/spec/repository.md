# Repository

A pnpm monorepo: one Electron app and five small packages, with the roasting logic kept free of
Electron so a phone app can reuse it later.

```
roastpilot/
  apps/desktop/          Electron app
    src/main/            composition root: wires core, drivers, storage; IPC handlers
    src/preload/         contextBridge facade
    src/renderer/        screens, Zustand stores, feature components
  packages/
    core/                pure TypeScript: state machine, PID, controllers, rules, registries, events
    drivers/             RoasterDriver + Transport implementations (Skywalker TC4, Simulator, Serial)
    storage/             Drizzle schema, migrations, repositories (node:sqlite)
    shared/              types, IPC contract + zod schemas, units, constants
    ui/                  design-system components (shadcn), tokens.json, generated CSS
  firmware/skywalker-tc4/  the SkyCommand sketch, credited to SkywalkerRoaster, with a protocol version
  docs/spec/             this spec, split by topic
  docs/adr/              decision records
  .claude/               skills, hooks, rules summary
  .github/               CI and PR template
  CLAUDE.md              root rules for every session
```

## Dependency rules

| Package              | May import       |
| -------------------- | ---------------- |
| `shared`             | nothing internal |
| `core`               | `shared`         |
| `drivers`, `storage` | `core`, `shared` |
| `ui`                 | `shared`         |
| `apps/desktop`       | everything       |

Enforced by ESLint (`eslint-plugin-boundaries`) and CI. Only `apps/desktop` may import Electron.
`core` never touches Electron, Node I/O or the network.

## Rules before code

1. **Root `CLAUDE.md`:** short and always loaded: principles, dependency rules, commands, definition of done.
2. **One `CLAUDE.md` per package:** loaded when working there.
3. **`engineering-standards` skill:** the full checklist, loaded before writing or changing code.
4. **Hooks:** a session-start hook puts the rules summary in context; a hook stops the first file edit of a session until the agent has loaded `engineering-standards`.
5. **Machine checks:** typecheck, ESLint, Prettier, tests: on commit (lint-staged) and in CI. A rule that can be a lint rule is a lint rule.

## Skills

| Skill                   | Does                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| `engineering-standards` | The rules checklist; loaded before any code change                               |
| `plan-feature`          | Spec first: updates `docs/spec`, writes an ADR if needed, then a task list       |
| `add-extension`         | Adds and registers a new implementation of any extension point, drivers included |
| `add-component`         | Builds a UI component from the design system: tokens only, accessible, tested    |
| `add-migration`         | Changes the schema safely: migration, repository, tests                          |
| `sync-tokens`           | Pulls `tokens.json` from the design system and regenerates CSS                   |
| `firmware-change`       | Changes the sketch, the driver and the protocol version together                 |
| `simulate`              | Runs scripted roasts on the simulator: cold start, back-to-back, lost connection |
| `pid-tune`              | Reads roast logs and suggests PID gains per roaster                              |
| `code-review`           | Checks a change against the principles, boundaries and tests                     |
| `design-review`         | Checks a screen against the design system                                        |
| `release`               | Version bump, changelog, build and sign the macOS DMG                            |

## Workflow

- Feature branches and pull requests; `main` is protected.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
- GitHub Actions on every PR, on Ubuntu and Windows: install, format check, lint, typecheck, test, build.
- commitlint checks commit messages; Dependabot opens grouped weekly update PRs.
- Design tokens flow one way: design system → `packages/ui/tokens.json` (`sync-tokens`) → generated CSS.
