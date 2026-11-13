# Design and code principles

Non-negotiable: UX comes first, no walls of text, and clean, reusable code throughout
(SOLID, KISS, DRY).

## UX rules

- **One obvious next action:** each roast phase shows one primary button, the biggest thing on screen.
- **Numbers, not sentences:** status is shown as big values, colour and icons. Any helper text is one short line.
- **Readable from 1–2 m:** large type for temperature and time; green / amber / red only for real states.
- **No pop-ups mid-roast, except a confirmation you asked for:** alerts appear as a banner plus sound and never block the controls. The one dialog is the confirmation after you press something that can't be undone or ends something (Delete, Clear, Stop roast, Stop); it opens only from your own click and Escape or Cancel closes it.
- **One design system:** shared tokens for colour, type and spacing, so every screen looks and behaves the same.

## Code rules

TypeScript everywhere, React for the renderer.

| Principle             | How it shows up                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Single responsibility | One job per module: `RoasterDriver`, `Transport`, `RoastController`, `PidController`, `SafetyMonitor`, `RoastRepository`              |
| Dependency inversion  | The controller depends on the `RoasterDriver` interface, never on the Arduino or `serialport`. Swapping hardware = a new driver class |
| Open/closed           | Drivers, transports, end rules and fan schedules are pluggable; adding one doesn't touch the controller                               |
| KISS                  | Plain classes and events in main, one state machine, no extra frameworks                                                              |
| DRY                   | `packages/shared` for types, IPC contract, units and limits; one component per UI element                                             |

Patterns used: **State** (roast phases), **Strategy** (end rules, fan schedules), **Observer**
(readings via events), **Repository** (SQLite access), **Adapter** (one driver per device),
**Facade** (the preload API), **Factory** (picks the driver by the active roaster's model), **Registry**
(extension points), **event bus** (domain events).

Reusable UI components: `Button`, `StatCard`, `OutputControl` (slider + Auto/Manual badge),
`CoachCard`, `PhaseStepper`, `AlertBanner`, `RoastChart`, `EditableTable`.
