# Repository

A pnpm monorepo: one Electron app and five small packages, with the roasting logic kept free of
Electron so a phone app can reuse it later.

```
roastpilot/
  apps/desktop/          Electron app
    src/main/            composition root: wires core, drivers, storage; IPC handlers
    src/preload/         contextBridge facade
    src/renderer/        screens, Zustand stores, feature components
    src/screenshots/     README scenes: main's services headless on the Simulator, as Storybook stories
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
  .github/               CI, PR template, issue templates
  AGENTS.md              root rules for every coding agent (CLAUDE.md imports it)
  README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, CHANGELOG.md, LICENSE
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

1. **Root `AGENTS.md`:** short and always loaded: principles, dependency rules, commands, definition of done, and which skill file to read for each task. Every agent reads `AGENTS.md`; each `CLAUDE.md` is just `@AGENTS.md`, so nothing is written twice.
2. **One `AGENTS.md` per package:** loaded when working there.
3. **`engineering-standards` skill:** the full checklist, loaded before writing or changing code.
4. **Hooks:** a session-start hook puts the rules summary in context; a hook stops the first file edit of a session until the agent has loaded `engineering-standards`.
5. **Machine checks:** typecheck, ESLint, Prettier, tests: on commit (lint-staged) and in CI. A rule that can be a lint rule is a lint rule.

## Skills

| Skill                   | Does                                                                              |
| ----------------------- | --------------------------------------------------------------------------------- |
| `engineering-standards` | The rules checklist; loaded before any code change                                |
| `challenge`             | Checks a user-facing request against who the app is for and what it isn't         |
| `plan-feature`          | Spec first: updates `docs/spec`, writes an ADR if needed, then a task list        |
| `add-extension`         | Adds and registers a new implementation of any extension point, drivers included  |
| `add-component`         | Adds or changes a UI component, keeping `docs/design-system` in step              |
| `add-migration`         | Changes the schema safely: migration, repository, tests                           |
| `design-sync`           | Regenerates CSS from `tokens.json`; after merge, the claude.ai page from the repo |
| `firmware-change`       | Changes the sketch, the driver and the protocol version together                  |
| `simulate`              | Runs scripted roasts on the simulator: cold start, back-to-back, lost connection  |
| `pid-tune`              | Reads roast logs and suggests PID gains per roaster                               |
| `code-review`           | Checks a change against the principles, boundaries and tests                      |
| `design-review`         | Checks a screen against the design system                                         |
| `ui-check`              | Runs the app on a throwaway data folder, drives it and screenshots it             |
| `release`               | Picks the version, changelog, tag; CI builds and publishes the release            |
| `merge`                 | Merges main or a stack parent in, and checks what the incoming changes break      |

## Workflow

- Feature branches and pull requests; `main` is protected.
- Stacked PRs take the base's changes by merging it in, never by rebase or force-push; parallel tasks each use their own git worktree ([AGENTS.md](../../AGENTS.md#parallel-work)).
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
- GitHub Actions on every PR, on Ubuntu and Windows: install, format check, lint, typecheck, test, build.
- commitlint checks commit messages; Dependabot opens grouped weekly update PRs.
- The design system lives in the repo ([ADR 0020](../adr/0020-design-system-in-the-repo.md)): guidelines in `docs/design-system`, tokens in `packages/ui/tokens.json` → generated CSS (`pnpm --filter @roastpilot/ui tokens`). The claude.ai page is a read-only view regenerated with `/design-sync` after merges.

## Open source

Roastpilot is public under the GPL-3.0-or-later ([`LICENSE`](../../LICENSE); every `package.json`
says `"license": "GPL-3.0-or-later"`). The sketch in `firmware/` keeps its upstream GPL-3.0.
Newcomers start at `README.md` and `CONTRIBUTING.md`; `CODE_OF_CONDUCT.md` is the Contributor
Covenant 2.1; `SECURITY.md` sends security and safety bugs to GitHub's private vulnerability
reporting; `CHANGELOG.md` follows Keep a Changelog. Issues use the forms in
`.github/ISSUE_TEMPLATE` (bug, feature, new roaster). CI runs on `pull_request` with read-only
permissions and no secrets, so fork PRs are safe to run.
