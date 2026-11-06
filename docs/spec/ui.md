# UI

Seven screens: Roast, History, Beans, Profiles, Roasters, Settings and Logs. The roasting screen is readable from a step back from the laptop.
Visual language: the [Roastpilot design system](https://claude.ai/artifact/66HZ9N2dqd7ULbqovZktYe). Its components are built in `packages/ui` (`Button`, `Badge`, `StatCard`, `OutputControl`, `CoachCard`, `PhaseStepper`, `AlertBanner`) and shown in Storybook (`pnpm storybook`).

## App frame

- The top bar and safety banners are fixed: they never scroll away, so Emergency stop is always on screen.
- Each screen scrolls inside its own area; on Logs only the list of entries scrolls.
- Nothing scrolls sideways or gets clipped from the minimum window (960 × 640) up to full screen: long text truncates, numbers fit their cards, rows wrap.
- **Top bar:** the mark, the tabs Roast, History, Beans, Profiles, Roasters, Settings and Logs, then Emergency stop. The Roasters tab carries the connection as a dot (grey not connected, cyan connected, ember connecting or reconnecting) and says it to screen readers; on a wide window the connected roaster's name and the phase follow the tabs. It fits 960 × 640.
- **Sidebar:** History, Beans, Profiles, Roasters and Settings share one layout: a fixed-width column on the left (the `sidebar` size token) with the screen title on top and the list under it, the chosen item on the right. The list and the right side scroll separately. The chosen item has a grey highlight (`surface-raised`): it shows where you are, not a setting. The Roast screen's controls panel is not a sidebar.
- **Error page:** the window never goes blank. A screen that fails to draw shows, in its own area, "<Screen> hit a problem", the error in one line, Reload and Open log folder; the top bar, banners and Emergency stop keep working, and opening another screen leaves it. If the frame itself fails, the whole window shows the same page with Emergency stop above Reload while a roaster is connected. Reload only redraws the window: the roast keeps running in main. No stack trace on screen; the full error is in the log.
- **Confirmations:** anything that can't be undone or ends something (Delete, Clear, End roast, Stop the roaster cool-down) asks once in a small dialog: the question and what happens ("Delete this roast? · can't be undone"), the verb in red text for deletes, and Cancel. Escape or Cancel closes it; it opens only from your own click.
- **Menus:** actions you rarely need sit behind a "⋯" button (keyboard: arrows, Enter, Escape); the one main action stays outside it.
- **Scrollbars:** thin, a `border-strong` thumb on a transparent track, in both themes; never the light system gutter.
- **Brand:** the Roastpilot mark (a dark coffee bean on an ember tile, its cut running end to end) is the app icon in the Dock, the taskbar and the installers, and sits at the left of the top bar. The window title is "Roastpilot". In development the Dock shows the mark too; its name there stays "Electron", which macOS takes from the Electron bundle.
- **Roast strip:** on any screen but Roast, while a roast runs (Preheat to Cooling, or the roaster cool-down), a slim fixed row under the top bar shows what needs you first, then the numbers. When an action is due it leads, highlighted, as the flow panel names it ("Dump beans · Cooling 3:58 left"); only real prompts, never a guess. Otherwise it is quiet numbers: `Roasting · 7:42   Temp 182.4 °C   RoR 8.1   Heater 60 %   Fan 40 %` (the temperature under the connected roaster's short name, [extensibility.md](extensibility.md)). Clicking it opens Roast. It is tinted ember (`heat-tint`) with the phase and clock in `heat` and a pulsing dot, so a running roast shows from across the room. Safety stays in the banners, never in the strip. It fits 960 × 640: numbers only, no hints.

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

- **Top bar:** connection (the Roasters tab's dot), active roaster, selected bean and profile, phase name.
- **Milestone 2:** the manual flow from [manual-mode.md](manual-mode.md): top bar (connection status, state), phase stepper, big numbers (BT, RoR, time, development), live chart (BT and RoR, charge/FC/drop markers, heater and fan strip), heater and fan controls, drum and filter fan switches, flow buttons and the red Emergency stop. Safety trips show as one banner per event with Acknowledge on it ("Emergency stop · heater off, fan and cooling on"); a separate Heater locked banner only when the lock outlives every trip. The focus ring shows only for keyboard focus. Bean, profile, ghost and coach come later.
- **Milestone 4:** adds the Auto / Manual switch, a choice of profile with "needs calibration", Auto badges and Resume auto on heater and fan, the current phase and next trigger as one line in the flow panel ("Yellowing · next at 165 °C"), Charge soon, the profile's dashed curve and the dry-end marker on the chart. Soak time lives in Settings under Auto. Bean, ghost, coach and the RoR band come later.
- **Preheat:** shows the between-batch protocol (cool, climb, hold countdown), then "Add beans".
- **Before preheat:** bean picker, batch weight (prefilled from the bean's batch plan), then the suggested profile and ghost with a one-line reason and a Change link for each.
- **Phase stepper:** Preheat, Roast, First crack, Drop, Cool; finished stages show their duration underneath (see [manual-mode.md](manual-mode.md)).
- **Big numbers:** current temp, RoR (°C/min), elapsed time, development time, delta vs ghost.
- **Chart:** live temperature vs the profile's reference points (dashed), the current phase's RoR band, RoR on a second axis, ghost faded behind, markers for charge, turning point (TP), dry end, FC and drop. The live lines stop at cool end (or End roast), as History saves them; after that only the BT number stays live, showing the drum cooling.
- **Outputs strip:** a slim band under the chart with heater and fan as step lines (0–100 %), on the chart's time axis and markers, so every change lines up with the curve it caused. It has its own legend; heater and fan keep the colours of their sliders.
- **Temperature axis:** fixed from 0 to 250 °C, growing in 50 °C steps if the roast goes hotter, so sensor jitter stays invisible. The temperature line is drawn as a weighted average of the last 3, 5 or 10 s of readings, newest counting most (a setting: Off, 3 s, 5 s or 10 s; default 3 s, Artisan's default of 3 readings at 1 s). Like Artisan's curve filter, it hides jitter with about half the lag of a plain average. The big number is always the raw reading.
- **RoR line:** drawn from charge to drop (or End roast), as Artisan does; none in preheat or cooling. Values outside −10…45 °C/min (Artisan's limits) are left out as gaps, so the dip at charge never stretches the axis.
- **Hover:** pointing at the chart or the strip draws one dashed line through both and puts the values there in the legends: the time first, then each line's value (`7:42 · Temperature 198.4 °C · RoR 9.1 °C/min`, heater and fan in the strip's legend); a dash where a line has no value. Leaving the chart brings the names back. Same on History, the compared roast included.
- **Gaps:** readings more than 3 s apart are drawn as a break in every line, never joined.
- **Connection lost:** sliders show a dash instead of their last values, and the flow panel shows "Reconnecting… · check the cable" with no button until readings are back.
- **Side panel follows the roast:** it shows only what the moment needs, top to bottom:

  | State                       | Panel                                                                 |
  | --------------------------- | --------------------------------------------------------------------- |
  | Not connected or connecting | The next action (Connect a roaster), then the setup card. No outputs. |
  | Ready                       | The setup card, then the next action (Preheat), then the outputs.     |
  | Preheat to Done             | The next action, then the outputs, then the setup card.               |

- **Setup card:** one row, folded by default: what the roast is of, "Light · Steps · Ethiopia Guji · 375 g · ghost Wed 4 Nov · 14:32" ("Manual" leads in a manual roast), a ▾ to unfold it, and an Auto switch that stays live at any time. Unfolded before or after a roast: profile (Auto), bean, batch and ghost; mid-roast: the ghost only, the one part that can still change, and the profile only while it isn't locked.
- The panel and the chart column scroll on their own, so the action and the sliders stay in view at 960 × 640.
- **Mode switch:** Auto / Manual. In Manual, the coach card sits above the outputs.
- **Outputs:** heater % and fan %, each with a slider. The Auto / Manual badge and Resume auto show only while Auto drives the roast (Preheat until Drop); in a manual roast there is nothing to tell apart. Drum, filter fan and cooling are one row of three labelled switches. With the connection lost they stay, showing dashes.
- **Buttons:** Preheat, Start (charge), First crack, Drop now, and a red Emergency stop that is always visible (disabled only while no roaster is connected).
- **After cooling:** roasted weight, rating, star and notes in a card over the chart, never a dialog, and all skippable. Weights are checked as you type: green at most the batch max of the roaster it ran on ("At most 400 g on Skywalker"), roasted never more than green, both above 0; a weight with a problem isn't saved. A loss outside 5–30 % gets a quiet "Unusual" note but saves. Saved as you enter them, with a quiet "Saved" after each ("Saves as you go" before); Done hides the card for that roast. They stay until the next Preheat or Clear, and can be changed later in History.

## Profiles screen

- **Header:** the profile's name as the title (click to rename; built-ins are read-only), with Built-in, Needs calibration and Not saved as badges; on the right one action for the state: Save and Discard while edited, else Use for Auto, or an AUTO badge if Auto already uses it; then "⋯" with Duplicate, Copy to <roaster> and Delete (red).
- **List:** the profile Auto uses carries an AUTO badge (`air`), unsaved ones Edited.
- **Milestone 4:** list on the left (the shared sidebar), editor on the right. Built-ins are read-only with Duplicate; a copy can be renamed, edited, saved, discarded or deleted (asked once inline). "Use for Auto" picks the one Auto runs.
- Top values: charge temp, dry-end temp, development time, BT cap, batch size.
- Steps table: one row per step. A step profile has end temp, duration, RoR range, heat estimate, fan and backup time; a curve profile has end temp, heat estimate, fan and backup time, plus a table of curve points (time, temp). Add and remove steps; Soak comes first and Development last, always. The soak's length is the Soak time setting.
- A preview chart shows the planned curve and the heater and fan steps, and updates as you type. Problems show next to the cell, one line each, and Save waits until there are none.
- With Auto on, the profile stays put from Preheat until Drop: no other choice on the Roast screen or with Use for Auto, and the one running can't be saved or deleted. Unsaved edits wait, and other profiles can still be edited. The Auto / Manual switch stays live.
- The list stays still and only the editor scrolls.
- **Milestone 5:** the list shows the active roaster's profiles; Copy to another roaster when there's another one.
- **Milestone 6:** Make step profile and Make curve profile on a History roast open the new copy here.
- **Later:** drag points on the chart, and the milestone builder to draw a curve from a few milestones (milestone 8).
- New profile from a roast: "Make step profile" (phases from its heat/fan changes) or "Make curve profile" (its BT curve).
- Import an Artisan `.alog` as a curve profile.
- "Copy to another roaster" makes a copy marked "needs calibration".

## History screen

- **Sidebar:** the title with "⋯" (Export CSV, Import from Artisan), then one row of filters: ★ (favourites only) and Bean ▾ / Profile ▾ chips that show their name until they filter, then the choice ("Ethiopia Guji ▾") in ember; then the list.
- **The open roast:** one header row: its date and time as the title, Compare ▾, Make profile ▾ (Step profile, Curve profile) and "⋯" (Delete, asked in a dialog). The roast being roasted shows "Saving as it roasts" instead of the last two.
- List of roasts in the shared sidebar, newest first: date and time, total time (charge to drop), first crack time, drop temp; Unfinished when cooling never ended.
- Open a roast to see its chart, stage times and events; under the chart, a small events table (secondary text): Event · Time · Temp · RoR · Heater · Fan for Charge, Turning point, First crack, Drop and Cool end (or End), with the values read from the saved samples at each event, so older roasts get it too. A dash where there is no value; Compare overlays one other roast, faded, aligned at charge.
- Delete asks once ("Delete this roast? · can't be undone"), then the list moves to the next roast.
- **Milestone 6:** bean, profile, rating and star on each row; filter by bean, profile or favourites; edit weight, rating, star and notes on the open roast; Make step profile and Make curve profile.
- Later: Export CSV.

## Beans screen

- Bean list: name, origin, process, stock left, low-stock badge.
- Bean detail: its info, all its roasts with stars, and its best favourite.
- Actions: Add bean, Edit, Add stock (with the batch calculator), Adjust stock, Make a profile for this bean, Archive, Roast this bean.
- List on the left (the shared sidebar), detail on the right; the two scroll separately.

## Batch calculator

- Order weight in, two plans out side by side; pick one to save it to a bean.

## Logs screen

- Milestone 2: the log viewer from [errors-and-logging.md](errors-and-logging.md#viewer).

## Roasters screen

- The sidebar lists the roaster records by name, the active one marked Active, and Add roaster under them. It opens on the roaster in use, else the active one.
- **A roaster's page:** its name and model, then one primary action: Connect, or Disconnect for the one in use (Connecting… busy while it connects; a failure is one line under it). Connect makes this roaster the active one first; Use this roaster (quiet, by the name) makes it active without connecting, as Profiles and batch sizes follow it.
- **Port:** a Skywalker-type roaster shows its port, with Choose another to list likely roasters (USB serial adapters), the rest behind "Show all ports" (every port at once when none looks like a roaster), and Refresh. A Simulator has no port. When no port is plugged in, one hint: "No roaster found · plug it in, then Refresh".
- **While a roaster is in use:** its page shows Disconnect and its status (Connected, Reconnecting…); every other page says "Disconnect <name> to switch", and records wait, as [roasters.md](roasters.md) says.
- Under the action, the record: name, batch size (min, ideal, max), limits and calibration (max temp, max time, temp offset) and the preheat hold, then Save and Delete.
- **Advanced tuning · for experts:** closed until opened, the PID gains in plain words, with one line above them: "Push (Kp): how hard the heater reacts to being off target · Catch-up (Ki): closes a gap that stays". Preheat (Push, Catch-up), Reaching step temperatures (Push, Catch-up, Most it may change %), Following a curve (Push, Catch-up). Each plain name carries the usual one in brackets ("Push (Kp)", "Most it may change (limit)"). Same numbers and limits as before.
- **Add roaster:** a name and a model, then Add; the new roaster opens.
- The app starts on Roasters until a roaster is connected; Connect on the Roast screen opens it too.

## Settings

- The shared sidebar lists the sections Controls, Roast, Auto and Chart; only the chosen one shows. Settings opens on Controls when the app starts, then on the last section viewed until quit (not saved).
- **Rows:** each setting is one row: name with a one-line hint under it on the left, its control on the right (it wraps under the name when narrow). On / off settings are a switch; other choices a segmented control. The chosen option keeps the `heat-tint` toggle look. A setting that doesn't apply is hidden (Cool the roaster to, while Cool the roaster after each roast is off; the cooling time or temperature, by Cooling ends).
- **Sections:** Controls (Guided / Full control, see [manual-mode.md](manual-mode.md)); Roast (Find the charge point, on; Cooling ends, by time 2–6 min (default 4) or below 70–100 °C (default 90 °C); Cool the roaster after each roast, on; Cool the roaster to, 40–70 °C, default 50 °C); Auto (Soak time); Chart (temperature smoothing: Off, 3 s, 5 s or 10 s). Saved in `settings.json` in the app's user-data folder behind a `SettingsStore` interface.
- Roasters and connecting have their own screen (above).
