# UI

Five screens plus Settings. The roasting screen is readable from a step back from the laptop.
Visual language: the [Roastpilot design system](https://claude.ai/artifact/66HZ9N2dqd7ULbqovZktYe). Its components are built in `packages/ui` (`Button`, `Badge`, `StatCard`, `OutputControl`, `CoachCard`, `PhaseStepper`, `AlertBanner`) and shown in Storybook (`pnpm storybook`).

## Roast screen (main)

- **Top bar:** connection status, active roaster, selected bean and profile, phase name.
- **Milestone 2:** the manual flow from [manual-mode.md](manual-mode.md): top bar (connection status, state), phase stepper, big numbers (BT, RoR, time, development), live chart (BT and RoR, charge/FC/drop markers), heater and fan controls, drum switch, flow buttons and the red Emergency stop. Safety trips show as banners with Acknowledge. Bean, profile, ghost and coach come later.
- **Preheat:** shows the between-batch protocol (cool, climb, hold countdown), then "Add beans".
- **Before preheat:** bean picker (search + recent), batch weight (prefilled from the bean's batch plan), then the suggested profile and ghost with a one-line reason and a Change link for each.
- **Phase stepper:** Preheat, Roast, First crack, Drop, Cool.
- **Big numbers:** current temp, RoR (°C/min), elapsed time, development time, delta vs ghost.
- **Chart:** live temperature vs the profile's reference points (dashed), the current phase's RoR band, RoR on a second axis, ghost faded behind, markers for charge, dry end, FC and drop.
- **Mode switch:** Auto / Manual. In Manual, the coach card sits above the outputs.
- **Outputs:** heater % and fan %, each with a slider and an Auto/Manual badge.
- **Buttons:** Preheat, Start (charge), First crack, Drop now, and a red Emergency stop that is always visible.
- **After cooling:** roasted weight prompt, rating, star, and the phase split.

## Profiles screen

- List of profiles; built-ins can be duplicated, not overwritten.
- Edit phases in a table (heat mode, heat %, fan %, RoR band, next-phase trigger), with a preview chart.
- Curve editor: drag points on the chart or edit them in a table; milestone builder to draw a curve from a few milestones.
- New profile from a roast: "Make step profile" (phases from its heat/fan changes) or "Make curve profile" (its BT curve).
- Import an Artisan `.alog` as a curve profile.
- "Copy to another roaster" makes a copy marked "needs calibration".

## History screen

- List of roasts: date, bean, profile, drop temp, total time, rating, star.
- Filter by bean, profile or favourites.
- Open a roast to see its chart and events; overlay another roast to compare.
- Actions: star, Make profile from this, Export CSV.

## Beans screen

- Bean list: name, origin, process, stock left, low-stock badge.
- Bean detail: its info, all its roasts with stars, and its best favourite.
- Actions: Add bean, Adjust stock, Archive, Roast this bean.

## Batch calculator

- Order weight in, two plans out side by side; pick one to save it to a bean.

## Settings

- Roasters: list, add, edit, set active. Safety limits and tuning live in each roaster.
- Simulator: always available as a roaster, for practice and demos. It never runs unless you pick it.
- **Milestone 2 (minimal):** Connection (serial port list with Refresh, or Simulator; Connect / Disconnect) and Controls (Guided / Full control, see [manual-mode.md](manual-mode.md)). Saved in `settings.json` in the app's user-data folder behind a `SettingsStore` interface; roaster records replace the connection part at milestone 5.
