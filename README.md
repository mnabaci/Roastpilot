# Roastpilot

Roasts coffee on autopilot. Coaches you when you take the controls.

A macOS desktop app for small drum roasters, starting with a modded Skywalker
([SkywalkerRoaster](https://github.com/jmoore52/SkywalkerRoaster)). Pick a bean and a profile,
press Start, and Roastpilot drives heater and fan along the curve, marks dry end, waits for your
first-crack tap, then drops and cools on its own.

> Status: scaffolded, implementation starting at milestone 1 (`docs/spec/build-order.md`).

## Getting started

Requires Node 22 and pnpm 10 (`corepack enable`).

```sh
pnpm install
pnpm dev      # start the app
pnpm check    # format check, lint, typecheck, test
```

## Repository

| Path                    | What                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| `apps/desktop`          | Electron app (main, preload, renderer)                              |
| `packages/core`         | Roasting logic: state machine, PID, rules, safety (pure TypeScript) |
| `packages/drivers`      | Roaster drivers and transports, incl. the simulator                 |
| `packages/storage`      | SQLite schema, migrations, repositories                             |
| `packages/shared`       | Types and the IPC contract                                          |
| `packages/ui`           | Design-system components and tokens                                 |
| `firmware/`             | Arduino sketch notes and protocol                                   |
| `docs/spec`, `docs/adr` | Spec and decisions                                                  |
| `.claude/`              | Agent skills, hooks and rules                                       |

## Safety

Roastpilot controls a heater. Never leave the roaster unattended.
