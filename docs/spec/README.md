# Roastpilot spec

The source of truth for what Roastpilot does and how it is built. Change the spec first
(`plan-feature` skill), then the code.

| File                                                   | Covers                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| [overview.md](overview.md)                             | Goal, scope and the decisions made so far                        |
| [principles.md](principles.md)                         | UX rules, code rules, design patterns                            |
| [extensibility.md](extensibility.md)                   | Extension points, generic data, where to stop                    |
| [errors-and-logging.md](errors-and-logging.md)         | Error kinds, how each is handled, what and where we log          |
| [tech-stack.md](tech-stack.md)                         | Libraries and why                                                |
| [repository.md](repository.md)                         | Monorepo layout, dependency rules, agent setup, workflow         |
| [hardware.md](hardware.md)                             | Skywalker mod, Arduino, serial protocol                          |
| [architecture.md](architecture.md)                     | Main vs renderer, device layer, modules                          |
| [roast-control.md](roast-control.md)                   | Profiles, PID, fan schedule, phases, manual override, conditions |
| [beans-favourites-ghost.md](beans-favourites-ghost.md) | Profiles, beans, favourites, suggestions, ghost layer            |
| [roasters.md](roasters.md)                             | Plug-and-play roaster records                                    |
| [manual-mode.md](manual-mode.md)                       | Manual mode and the live coach                                   |
| [batch-and-stock.md](batch-and-stock.md)               | Batch calculator and stock tracking                              |
| [ui.md](ui.md)                                         | Screens                                                          |
| [safety.md](safety.md)                                 | Safety rules                                                     |
| [data-model.md](data-model.md)                         | SQLite tables                                                    |
| [install-and-update.md](install-and-update.md)         | Releases, installers, updates, data across updates               |
| [build-order.md](build-order.md)                       | Milestones and open questions                                    |

Design system: [Roastpilot](https://claude.ai/artifact/66HZ9N2dqd7ULbqovZktYe) (tokens synced into `packages/ui/tokens.json`).
