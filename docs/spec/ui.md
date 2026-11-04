# UI

Five screens plus Settings. The roasting screen is readable from a step back from the laptop.
Visual language: the [Roastpilot design system](https://claude.ai/artifact/66HZ9N2dqd7ULbqovZktYe). Its components are built in `packages/ui` (`Button`, `Badge`, `StatCard`, `OutputControl`, `CoachCard`, `PhaseStepper`, `AlertBanner`) and shown in Storybook (`pnpm storybook`).

## App frame

- The top bar and safety banners are fixed: they never scroll away, so Emergency stop is always on screen.
- Each screen scrolls inside its own area; on Logs only the list of entries scrolls.
- Nothing scrolls sideways or gets clipped from the minimum window (960 × 640) up to full screen: long text truncates, numbers fit their cards, rows wrap.

## App menu

| Menu                    | Items                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| Roastpilot (macOS only) | About, Settings… (⌘,), Services, Hide, Quit (⌘Q)                         |
| File                    | macOS: Close window. Windows: Settings… (Ctrl+,), Quit                   |
| Edit                    | Undo, Redo, Cut, Copy, Paste, Select all                                 |
| View                    | Zoom, Full screen. Reload and developer tools only in development builds |
| Window, Help            | Standard window items; Help → Open log folder                            |

- Quit always goes through the safe stop first (docs/spec/safety.md), whichever way it is chosen.
- Settings… opens the Settings screen, even mid-roast; the roast keeps running in main.

## Roast screen (main)

- **Top bar:** connection status, active roaster, selected bean and profile, phase name.
- **Milestone 2:** the manual flow from [manual-mode.md](manual-mode.md): top bar (connection status, state), phase stepper, big numbers (BT, RoR, time, development), live chart (BT and RoR, charge/FC/drop markers, heater and fan strip), heater and fan controls, drum and filter fan switches, flow buttons and the red Emergency stop. Safety trips show as one banner per event with Acknowledge on it ("Emergency stop · heater off, fan and cooling on"); a separate Heater locked banner only when the lock outlives every trip. The focus ring shows only for keyboard focus. Bean, profile, ghost and coach come later.
- **Preheat:** shows the between-batch protocol (cool, climb, hold countdown), then "Add beans".
- **Before preheat:** bean picker (search + recent), batch weight (prefilled from the bean's batch plan), then the suggested profile and ghost with a one-line reason and a Change link for each.
- **Phase stepper:** Preheat, Roast, First crack, Drop, Cool; finished stages show their duration underneath (see [manual-mode.md](manual-mode.md)).
- **Big numbers:** current temp, RoR (°C/min), elapsed time, development time, delta vs ghost.
- **Chart:** live temperature vs the profile's reference points (dashed), the current phase's RoR band, RoR on a second axis, ghost faded behind, markers for charge, dry end, FC and drop.
- **Outputs strip:** a slim band under the chart with heater and fan as step lines (0–100 %), on the chart's time axis and markers, so every change lines up with the curve it caused. It has its own legend; heater and fan keep the colours of their sliders.
- **Temperature axis:** fixed from 0 to 250 °C, growing in 50 °C steps if the roast goes hotter, so sensor jitter stays invisible. The temperature line is drawn as a moving average (a setting: Off, 5 s or 10 s; default 5 s); the big number is always the raw reading.
- **Hover:** pointing at the chart or the strip draws one dashed line through both and puts the values there in the legends: the time first, then each line's value (`7:42 · Temperature 198.4 °C · RoR 9.1 °C/min`, heater and fan in the strip's legend); a dash where a line has no value. Leaving the chart brings the names back. Same on History, the compared roast included.
- **Gaps:** readings more than 3 s apart are drawn as a break in every line, never joined.
- **Connection lost:** sliders show a dash instead of their last values, and the flow panel shows "Reconnecting… · check the cable" with no button until readings are back.
- **Mode switch:** Auto / Manual. In Manual, the coach card sits above the outputs.
- **Outputs:** heater % and fan %, each with a slider and an Auto/Manual badge.
- **Buttons:** Preheat, Start (charge), First crack, Drop now, and a red Emergency stop that is always visible (disabled only while no roaster is connected).
- **After cooling:** roasted weight prompt, rating, star, and the phase split.

## Profiles screen

- List of profiles; built-ins can be duplicated, not overwritten.
- Edit phases in a table (heat mode, heat %, fan %, RoR band, next-phase trigger), with a preview chart.
- Curve editor: drag points on the chart or edit them in a table; milestone builder to draw a curve from a few milestones.
- New profile from a roast: "Make step profile" (phases from its heat/fan changes) or "Make curve profile" (its BT curve).
- Import an Artisan `.alog` as a curve profile.
- "Copy to another roaster" makes a copy marked "needs calibration".

## History screen

- List of roasts, newest first: date and time, total time (charge to drop), first crack time, drop temp; Unfinished when cooling never ended.
- Open a roast to see its chart, stage times and events; Compare overlays one other roast, faded, aligned at charge.
- Delete asks once ("Delete this roast? · can't be undone"), then the list moves to the next roast.
- Later milestones: bean, profile, rating and star columns; filter by bean, profile or favourites; Make profile from this; Export CSV.

## Beans screen

- Bean list: name, origin, process, stock left, low-stock badge.
- Bean detail: its info, all its roasts with stars, and its best favourite.
- Actions: Add bean, Adjust stock, Archive, Roast this bean.

## Batch calculator

- Order weight in, two plans out side by side; pick one to save it to a bean.

## Logs screen

- Milestone 2: the log viewer from [errors-and-logging.md](errors-and-logging.md#viewer).

## Settings

- Roasters: list, add, edit, set active. Safety limits and tuning live in each roaster.
- Simulator: always available as a roaster, for practice and demos. It never runs unless you pick it.
- **Milestone 2 (minimal):** Connection (the roaster used last with Connect and "Choose another", which lists likely roasters (USB serial adapters) and the Simulator, with other ports behind "Show all ports"; Refresh; Connect / Disconnect; while a roaster is in use, only its row shows, marked Connected (or Connecting…, Reconnecting…), and the top bar names it; while connecting, the app stays on Settings with a busy Connect button and a locked list, and a failure is one line under it) Controls (Guided / Full control, see [manual-mode.md](manual-mode.md)) and Chart (temperature smoothing: Off, 5 s or 10 s). Saved in `settings.json` in the app's user-data folder behind a `SettingsStore` interface; roaster records replace the connection part at milestone 5.
