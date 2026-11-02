# UI

Five screens plus Settings. The roasting screen is readable from a step back from the laptop.
Visual language: the [Roastpilot design system](https://claude.ai/artifact/66HZ9N2dqd7ULbqovZktYe).

## Roast screen (main)

- **Top bar:** connection status, active roaster, selected bean and profile, phase name.
- **Before preheat:** bean picker (search + recent), batch weight (prefilled from the bean's batch plan), then the suggested profile and ghost with a one-line reason and a Change link for each.
- **Phase stepper:** Preheat, Roast, First crack, Drop, Cool.
- **Big numbers:** current temp, RoR (°C/min), elapsed time, development time, delta vs ghost.
- **Chart:** live temperature vs target curve, RoR on a second axis, ghost faded behind, markers for charge, dry end, FC and drop.
- **Mode switch:** Auto / Manual. In Manual, the coach card sits above the outputs.
- **Outputs:** heater % and fan %, each with a slider and an Auto/Manual badge.
- **Buttons:** Preheat, Start (charge), First crack, Drop now, and a red Emergency stop that is always visible.
- **After cooling:** roasted weight prompt, rating, star, and the phase split.

## Profiles screen

- List of profiles; built-ins can be duplicated, not overwritten.
- Edit curve points and fan steps in a table, with a preview chart.
- "Make profile from this roast" copies a past roast's curve.

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
