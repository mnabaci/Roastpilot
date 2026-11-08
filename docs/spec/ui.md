# UI

Seven screens: Roast, History, Beans, Profiles, Roasters, Settings and Logs. The roasting screen is readable from a step back from the laptop.
Visual language: the [Roastpilot design system](https://claude.ai/artifact/66HZ9N2dqd7ULbqovZktYe). Its components are built in `packages/ui` (`Button`, `Badge`, `StatCard`, `OutputControl`, `CoachCard`, `PhaseStepper`, `AlertBanner`) and shown in Storybook (`pnpm storybook`).

## App frame

- The top bar and safety banners are fixed: they never scroll away, so Emergency stop is always on screen.
- Each screen scrolls inside its own area; on Logs only the list of entries scrolls.
- Nothing scrolls sideways or gets clipped from the minimum window (960 × 640) up to full screen: long text truncates, numbers fit their cards, rows wrap.
- **First launch:** the safety notice fills the window until you accept it ([safety.md](safety.md#safety-notice)).
- **Top bar:** the mark, the tabs Roast, History, Beans, Profiles, Roasters, Settings and Logs, then Emergency stop. The Roasters tab carries the connection as a dot (grey not connected, cyan connected, ember connecting or reconnecting) and says it to screen readers; on a wide window the connected roaster's name and the phase follow the tabs. It fits 960 × 640.
- **Sidebar:** History, Beans, Profiles, Roasters and Settings share one layout: a fixed-width column on the left (the `sidebar` size token) with the screen title on top and the list under it, the chosen item on the right. The list and the right side scroll separately. The chosen item has a grey highlight (`surface-raised`): it shows where you are, not a setting. The Roast screen's controls panel is not a sidebar. The chosen item's title (a Settings section's name too) sits on the line of the screen title, both in a row as tall as a small button (`control-sm`, 44 px); actions in that header row are small buttons, so they line up with the ⋯ and the dropdown chips beside them.
- **Page width:** the chosen item on the right (a Settings section, a roaster, the bean editor, the batch calculator, Add roaster) is at most 1152 px wide on every screen, so rows stay readable and controls stay near their labels on very wide windows.
- **Error page:** the window never goes blank. A screen that fails to draw shows, in its own area, "<Screen> hit a problem", the error in one line, Reload and Open log folder; the top bar, banners and Emergency stop keep working, and opening another screen leaves it. If the frame itself fails, the whole window shows the same page with Emergency stop above Reload while a roaster is connected. Reload only redraws the window: the roast keeps running in main. No stack trace on screen; the full error is in the log.
- **Confirmations:** anything that can't be undone or ends something (Delete, Clear, End roast, Stop drum cooling) asks once in a small dialog: the question and what happens ("Delete this roast? · can't be undone"), the verb in red text for deletes, and Cancel. Escape or Cancel closes it; it opens only from your own click.
- **Toasts:** one line, sentence case, verb + what + next step ("Couldn't delete the roast · try again"), bottom-right of the window, stacked with the newest at the bottom and at most 3 shown. On Roast they sit over the chart, left of the side panel, never over the numbers, flow buttons or sliders. An error stays until its × (Dismiss) and is announced as an alert; info and success fade after 4 s, pausing while hovered or focused. Only for an action whose result the screen doesn't show inline; never for safety, which stays in the red banners. Not a modal: nothing to press to carry on a roast.
- **Closing buttons:** a button that closes or acknowledges something (the coach's Dismiss, the finished roast's Done, History's select-mode Done, a banner's Acknowledge) is outlined (`outline`: `surface-raised` with a `border-strong` border), so it reads as a button on any background in both themes.
- **Menus:** actions you rarely need sit behind a "⋯" button (keyboard: arrows, Enter, Escape); the one main action stays outside it.
- **Dropdowns:** every dropdown, whether a field (Bean, Profile, Ghost, Process, Model), a filter chip (History's Bean, Logs' level) or a "⋯" menu, opens the same panel, never the system popup:
  - **Panel:** `surface-raised` with a 1 px `border-strong` outline, `radius-lg` and 4 px padding, as the "⋯" menu already looks; at least as wide as what opened it, up to 8 rows tall, then it scrolls; it stays on screen, flipping above when there's no room below.
  - **Rows:** 44 px tall (`control-sm`), hover and keyboard focus `surface-hover`, the chosen one with a ✓. An option can carry one quieter detail line (`label`, `ink-muted`) under its name; lists without details stay one line.
  - **Details:** Bean "300 g · Ethiopia · washed" (stock, origin, process); Ghost the roast's bean, stars and first crack ("Ethiopia Guji · ★★★★★ · FC 9:12"); Profile "Built-in" or "Needs calibration".
  - **Search:** a list of more than 8 options starts with "Search…", focused as it opens; typing narrows it (name and detail), Enter picks the first match, "No match" when nothing fits. Shorter lists have none.
  - **Keyboard:** arrows move, Enter picks, Escape closes and returns focus to what opened it; in a list without search, typing a letter jumps to the first option starting with it.
  - The field keeps its look (label above, value, ⌄); a filter chip keeps its look ("Bean ⌄", the choice in ember while it filters).
- **Scrollbars:** thin, a `border-strong` thumb on a transparent track, in both themes; never the light system gutter.
- **Brand:** the Roastpilot mark (a dark coffee bean on an ember tile, its cut running end to end) is the app icon in the Dock, the taskbar and the installers, and sits at the left of the top bar. The window title is "Roastpilot". In development the Dock shows the mark too; its name there stays "Electron", which macOS takes from the Electron bundle.
- **Roast strip:** on any screen but Roast, while a roast runs (Preheat to Cooling, or drum cooling), a slim fixed row under the top bar shows what needs you first, then the numbers. When an action is due it leads, highlighted, as the flow panel names it ("Dump beans · Cooling beans 3:58 left"); only real prompts, never a guess. In Auto these are Add beans, the Charge soon countdown, Beans in, and why Auto stopped ("Safety stop · Auto stopped"). Otherwise it is quiet numbers: `Roasting · 7:42   Temp 182.4 °C   RoR 8.1   Heater 60 %   Fan 40 %` (the temperature under the connected roaster's short name, [extensibility.md](extensibility.md)). Clicking it opens Roast. It is tinted ember (`heat-tint`) with the phase and clock in `heat` and a pulsing dot, so a running roast shows from across the room. Safety stays in the banners, never in the strip. It fits 960 × 640: numbers only, no hints.

## App menu

| Menu                    | Items                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roastpilot (macOS only) | About, Settings… (⌘,), Services, Hide, Quit (⌘Q)                                                                                                        |
| File                    | macOS: Close window. Windows: Settings… (Ctrl+,), Quit                                                                                                  |
| Edit                    | Undo, Redo, Cut, Copy, Paste, Select all; nothing else (macOS's Dictation, Emoji & Symbols and AutoFill are switched off)                               |
| View                    | Zoom (Actual size, Zoom in, Zoom out: ⌘0, ⌘+, ⌘−, for reading from across the room), Full screen. Reload and developer tools only in development builds |
| Window, Help            | Standard window items; Help → Safety notice, Open log folder                                                                                            |

- Quit always goes through the safe stop first (docs/spec/safety.md), whichever way it is chosen.
- Settings… opens the Settings screen, even mid-roast; the roast keeps running in main.

## Roast screen (main)

- **Top bar:** connection (the Roasters tab's dot), active roaster, selected bean and profile, phase name.
- **Milestone 2:** the manual flow from [manual-mode.md](manual-mode.md): top bar (connection status, state), phase stepper, big numbers (BT, RoR, time, development), live chart (BT and RoR, charge/FC/drop markers, heater and fan strip), heater and fan controls, drum and filter fan switches, flow buttons and the red Emergency stop. Safety trips show as one banner per event with Acknowledge on it ("Emergency stop · heater off, fan and bean cooler on"); a separate Heater locked banner only when the lock outlives every trip. The focus ring shows only for keyboard focus. Bean, profile, ghost and coach come later.
- **Milestone 4:** adds the Auto / Manual switch, a choice of profile with "needs calibration", Auto badges and Resume auto on heater and fan, the current phase and next trigger as one line in the flow panel ("Yellowing · next at 165 °C"), Charge soon, the profile's dashed curve and the dry-end marker on the chart. Soak time lives in Settings under Auto. Bean, ghost, coach and the RoR band come later.
- **Preheat:** shows the between-batch protocol (cool, climb, hold countdown), then "Add beans".
- **Before preheat:** bean picker, batch weight (prefilled from the bean's batch plan), then the suggested profile and ghost with a one-line reason and a Change link for each.
- **Phase stepper:** Preheat, Roast, First crack, Drop, Cool; finished stages show their duration underneath (see [manual-mode.md](manual-mode.md)).
- **Big numbers:** current temp, RoR (°C/min), elapsed time, development time, delta vs ghost. In Auto, mid-roast, the plan takes the ghost's place under the temperature from the plan's turning point on ("−4 °C vs plan", "On plan"), and the RoR card shows what the running step aims for ("Aim 8–10"; until your first-crack tap never below the stall guard's 5). A curve phase shows the one RoR it aims for now ("Aim 12"), worked out as Auto does from the curve, BT and the roaster's tuning; a stopped Auto shows no aim.
- **Chart:** live temperature vs the profile's reference points (dashed), the current phase's RoR band, RoR on a second axis, ghost faded behind, markers for charge, turning point (TP), dry end, FC and drop. The live lines stop at cool end (or End roast), as History saves them; after that only the BT number stays live, showing the drum cooling. Under it, the outputs strip: heater (ember), fan (cyan) and drum (neutral grey; an on/off drum shows 0 or 100%).
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

- **Setup card:** one row, folded by default: what the roast is of, "Light · Steps · Ethiopia Guji · 375 g · ghost Wed 4 Nov · 14:32" ("Manual" leads in a manual roast; a profile that needs calibration says so second: "Light · Steps · needs calibration · …"), a ▾ to unfold it, and an Auto switch that stays live at any time. Unfolded before or after a roast: profile (Auto), bean, batch and ghost; mid-roast: the ghost only, the one part that can still change, and the profile only while it isn't locked.
- The panel and the chart column scroll on their own, so the action and the sliders stay in view at 960 × 640.
- **Mode switch:** Auto / Manual. In Manual, the coach card sits above the outputs ([manual-mode.md](manual-mode.md#coach)): "Coach suggests", the change as a readout (one line per output, so heater and fan never wrap mid-way), the reason right under it, then Apply (primary) and Dismiss (secondary, outlined so it reads as a button on the tint), both 44 px tall. While Apply's call is on its way it reads "Applying…" and can't be pressed again; a heads-up says "Heads-up", then the line and Dismiss only, in the neutral tint, because it asks for no change. A profile that needs calibration is noted after the label, in one line ("Coach suggests · needs calibration").
- **Outputs:** heater % and fan %, each with a slider (a `border-strong` track filled in the output's colour up to the value, the same in both themes). The Auto / Manual badge and Resume auto show only while Auto drives the roast (Preheat until Drop); in a manual roast there is nothing to tell apart. Drum, filter fan and bean cooler are one row of three labelled switches. On a roaster whose drum has a speed, the drum is a slider instead (Drum, %, neutral grey: it is neither heat nor air), under the fan, and the row keeps filter fan and bean cooler. With the connection lost they stay, showing dashes.
- **Buttons:** Preheat, Start (charge), First crack, Drop now, and a red Emergency stop that is always visible (disabled only while no roaster is connected).
- **After cooling:** roasted weight, rating, star and notes in a card over the chart, never a dialog, and all skippable. Weights are checked as you type: green at most the batch max of the roaster it ran on ("At most 400 g on Skywalker"), roasted never more than green, both above 0; a weight with a problem isn't saved. A loss outside 5–30 % gets a quiet "Unusual" note but saves. Saved as you enter them, with a quiet "Saved" after each ("Saves as you go" before; "Not saved · try again" with an error toast after a failed save, until one lands); Done hides the card for that roast. They stay until the next Preheat or Clear, and can be changed later in History.

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
- **Milestone 8, milestone builder:** "⋯" on the list header has "New from milestones". The editor area shows a table (Milestone, Time, Temp) with the rows from [roast-control.md](roast-control.md), "Add point" for your own points (each with Remove), and the same preview chart, updating as you type. Create (primary) saves it and opens it in the editor; Cancel goes back to the profile you had open.
- **Drag points:** on your own curve profile, drag a point on the preview chart; it stays between its neighbours and under the BT cap.
- New profile from a roast: "Make step profile" (phases from its heat/fan changes) or "Make curve profile" (its BT curve).
- Import an Artisan `.alog` as a curve profile.
- "Copy to another roaster" makes a copy marked "needs calibration".

## History screen

- **Sidebar:** the title with "⋯" (Export all ▸ Roastpilot file / CSV, Import a Roastpilot file, Import from Artisan, Select), then one row of filters: ★ (favourites only) and Bean ▾ / Profile ▾ chips that show their name until they filter, then the choice ("Ethiopia Guji ▾") in ember; then the list.
- **Select:** checkboxes appear on the rows (Shift-click ticks a range) and a bar sits over the list: "3 selected", Export ▾ (Roastpilot file, CSV) and Done. Clicking a row ticks it instead of opening it until Done.
- **The open roast:** one header row: its date and time as the title, Compare ▾, Make profile ▾ (Step profile, Curve profile) and "⋯" (Export this roast as a Roastpilot file or CSV, then Delete, asked in a dialog). Beside the weights, Bean ▾ links the roast to a bean (stock as [data-model.md](data-model.md#roastpilot-roast-files) says). The roast being roasted shows "Saving as it roasts" instead of the last two.
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
- **Sidebar:** "Beans ⋯" (Batch calculator, Show archived), the list, then + Add bean under it.
- **A bean's header:** its name with Low stock and Archived badges; Roast this bean (main) and Add stock; then "⋯" with Adjust stock, Edit, Make a profile and Archive (Bring back when archived).

## Batch calculator

- Order weight in, two plans out side by side; pick one to save it to a bean.

## Logs screen

- Milestone 2: the log viewer from [errors-and-logging.md](errors-and-logging.md#viewer).
- "Logs ⋯" beside the title holds Open log folder, like the other screens' title menus.

## Roasters screen

- The sidebar lists the roaster records by name, the active one marked Active, and Add roaster under them. It opens on the roaster in use, else the active one.
- **A roaster's page:** its name and model, then one primary action: Connect, or Disconnect for the one in use (Connecting… busy while it connects; a failure is one line under it). Connect makes this roaster the active one first; its "⋯" by the name holds Use this roaster (makes it active without connecting, as Profiles and batch sizes follow it) and Delete (asked in a dialog).
- **Port:** a Skywalker-type roaster shows its port, with Choose another to list likely roasters (USB serial adapters), the rest behind "Show all ports" (every port at once when none looks like a roaster), and Refresh. A Simulator has no port. When no port is plugged in, one hint: "No roaster found · plug it in, then Refresh".
- **While a roaster is in use:** its page shows Disconnect and its status (Connected, Reconnecting…); every other page says "Disconnect <name> to switch", and records wait, as [roasters.md](roasters.md) says.
- Under the action, the record: name, batch size (min, ideal, max), limits and calibration (max temp, max time, temp offset) and the preheat hold, then Save. A roaster whose drum has a speed also has a Drum group: "Drum speed" (%), hint "Usual speed · from Preheat, and while cooling".
- **Advanced tuning · for experts:** closed until opened, the PID gains in plain words, with one line above them: "Push (Kp): how hard the heater reacts to being off target · Catch-up (Ki): closes a gap that stays". Preheat (Push, Catch-up), Reaching step temperatures (Push, Catch-up, Most it may change %), Following a curve (Push, Catch-up, Most it may change %, Look ahead s, Pull to the curve per °C, Heater change per 10 s %). Each plain name carries the usual one in brackets ("Push (Kp)", "Most it may change (limit)"). Same numbers and limits as before.
- **Add roaster:** a name and a model, then Add; the new roaster opens.
- The app starts on Roasters until a roaster is connected; Connect on the Roast screen opens it too.

## Sounds

- **What:** short sounds through the computer's speakers when something needs you, so you can hear it over the roaster. Synthesised in the window with Web Audio (no files) through a compressor, played by the one main window, once per change (then repeated as set, below): never again on later readings.
- **Steps and defaults:**

| Step                   | Plays when                                                                         | Still waiting while                           | Default voice, volume | Repeat     |
| ---------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- | --------------------- | ---------- |
| Charge soon            | Auto's preheat reaches Add beans                                                   | the preheat step is still Add beans           | Chime, 80 %           | Until done |
| Beans in               | Auto's preheat reaches Beans in                                                    | the preheat step is still Beans in            | Chime, 80 %           | Until done |
| Listen for first crack | once per roast, while Roasting with no first-crack tap, BT reaches expected − 3 °C | Roasting with no first-crack tap              | Ping, 70 %            | Once       |
| Dump beans             | the roast enters Cooling                                                           | the roast is Cooling                          | Chime, 80 %           | 2 times    |
| Auto stopped           | Auto hands you the outputs mid-run (Preheat to Development)                        | Auto is stopped (until Resume auto or Manual) | Alert, 90 %           | 3 times    |

- **Order:** the steps are listed in the order they happen in a roast; Auto stopped is last because it can happen at any point.
- **Repeat:** Once, 2 times or 3 times play back to back, each a brief 0.3 s pause after the last ends; Until done plays every 10 s while the step is still waiting, for at most 1 minute (7 plays). Any repeat stops at once when its step stops waiting, Sounds is switched off or that step's setting changes; two plays of one step never overlap.
- **Expected first crack:** the median BT at first crack of the last 5 saved roasts that have one, from the active roaster when it has any, otherwise from all. Without any, there is no listen cue. Sound only: nothing new on screen.
- **Voices:** Chime (rising 660 → 880 Hz), Ping (587 Hz), Alert (low 330 Hz twice), Bell (struck 784 Hz, rings out), Marimba (523 → 659 Hz, short), Beep (two square beeps, 1000 Hz), None. Volume 0–100 % in steps of 5 scales the voice's peak.
- **Never for safety:** a safety trip (Safety stop, Heater locked, Emergency stop) keeps its banner and plays nothing. A window that opens mid-roast stays quiet until the next change. Sound that can't play (no audio device, blocked) is logged once.

## Settings

- The shared sidebar lists the sections Controls, Roast, Auto, Sounds, Chart, Appearance and About; only the chosen one shows. Settings opens on Controls when the app starts, then on the last section viewed until quit (not saved).
- **Width:** each section is at most 1152 px wide, like every page ([App frame](#app-frame)), so a switch stays near its name on very wide windows.
- **Rows:** each setting is one row: name with a one-line hint under it on the left, its control on the right (it wraps under the name when narrow, the same way for every row of a section). On / off settings are a switch; other choices a segmented control. The chosen option keeps the `heat-tint` toggle look. A setting that doesn't apply is hidden (Cool the drum to, while Cool the drum after each roast is off).
- **Sections:** Controls (Guided / Full control, see [manual-mode.md](manual-mode.md)); Roast (Find the charge point, on; Coach in manual roasts, on; Cool the beans for, 2–6 min, default 4; Cool the drum after each roast, on; Cool the drum to, 40–70 °C, default 50 °C); Auto (Soak time); Sounds (the Sounds switch, on, "A chime when something needs you, and before first crack"; while on, a row per step, in roast order, with its voice, its Repeat (Once, 2 times, 3 times, Until done), a Volume slider, an icon-only Play that previews it as set, repeats included, and turns into Stop while plays are still to come (changing the step or leaving Settings stops it too), and an icon-only Reset (↺) while it differs from its default, whose place is kept when hidden so a change never moves the row; see [Sounds](#sounds)); Chart (temperature smoothing: Off, 3 s, 5 s or 10 s); Appearance (Theme: Dark, Light or Match system, default Dark. It changes at once, mid-roast too, and the window behind the page follows, so nothing flashes; Match system follows the computer's light or dark mode as it changes); About (version and updates, see [install-and-update.md](install-and-update.md#what-you-see)). Saved in `settings.json` in the app's user-data folder behind a `SettingsStore` interface.
- Roasters and connecting have their own screen (above).
