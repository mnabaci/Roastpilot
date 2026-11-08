# Roastpilot

Roastpilot is a desktop app that roasts coffee on autopilot and coaches you when you take the controls. This design system keeps every screen dark, precise and readable from a step back from the roaster: graphite surfaces, an ember accent for heat and cyan for air.

## Principles

- **One obvious next action.** Each roast phase shows one primary button (`control-lg`, `heat-fill`, with an icon). Everything else is secondary.
- **Numbers, not sentences.** Live state is a big readout (`readout-xl`) with a small label. Helper text is one line of `body` in `ink-muted`.
- **Readable from 1–2 m.** Readouts are 56px, labels 13px minimum, touch targets 44px minimum.
- **Never block the roast.** Alerts are banners plus sound, never dialogs. The one dialog is a confirmation the user opened with their own click (ConfirmDialog); Escape or Cancel closes it.
- **Colour means something.** Ember is heat, cyan is air, grey is reference. State colours appear only for real states.

## Voice and copy

- Sentence case everywhere except badges (`AUTO`, `MANUAL`, `BUILT-IN`).
- Lead with the value, then the unit with a space: `212 °C`, `9.4 °C/min`, `375 g`, `1:58`.
- Times are `m:ss` (`10:18`), never `10m 18s`.
- Verbs on buttons: Preheat, Beans in · Start, First crack, Drop now, Resume auto, Apply.
- Hints say what to do next, in one line: "Press First crack when you hear it."
- Coach suggestions give the change, one line per output, then the reason: "Heater 65% → 75%", "4 °C below target, RoR falling".

## Colour

Dark is the primary theme; light mirrors it for bright rooms and outdoor roasting.

| Role         | Token                                                              | Use                                                |
| ------------ | ------------------------------------------------------------------ | -------------------------------------------------- |
| Ground       | `bg`, `surface`, `surface-raised`, `surface-hover`                 | Graphite: page, cards, tiles inside cards, hover   |
| Text         | `ink`, `ink-muted`                                                 | Values and labels                                  |
| Heat (ember) | `heat`, `heat-fill`, `heat-fill-hover`, `heat-tint`, `on-heat`     | Temperature curve and readouts; the primary button |
| Air (cyan)   | `air`, `air-tint`                                                  | Fan, rate of rise, Auto badge, focus ring          |
| Reference    | `target`, `ghost`                                                  | Target curve (dashed), ghost roast (faded)         |
| State        | `good`, `warning`, `critical`, `critical-text`, `critical-surface` | Connected, low stock, safety                       |
| Focus        | `focus`                                                            | 2px ring, 2px offset, on every control             |

Rules:

- `heat-fill` is for the one primary action per screen and the heater slider. Never for decoration.
- `critical` (the fill) is reserved for Emergency stop and safety trips. Delete buttons use `critical-text` as text only, never a red fill, so a red block still always means safety.
- Ember and cyan sit on opposite sides of the colour wheel and differ in lightness, so they stay distinct for colour-blind users.
- Neutrals are cool graphite with no brown or cream: warmth comes only from the ember accent.

## Type

Inter, one family, with tabular numerals (`font-variant-numeric: tabular-nums`) everywhere so live numbers never jump.

- `readout-xl` live values, `readout-lg` summary values
- `title` screen titles and phase name, `heading` card titles
- `body` hints and tables, `label` labels and axes, `badge` uppercase badges

## Layout

- Page padding `space-6`; gap between cards `space-4` everywhere (Roast's columns and stat grid, History's stats); card padding `space-5`; card radius `radius-xl`.
- On list-and-detail screens the open item's title (a Settings section, Add a bean, Batch calculator, Add roaster too) is `title` type in a row at least `control-sm` tall, on the same line as the sidebar's screen title; its header actions are `sm`.
- Sidebar add buttons (Add bean, Add roaster) use the list rows' 12px side padding so their + lines up with the names; every Add button carries the + icon.
- Toasts are at most 448px wide, so a one-line toast stays on one line.
- Roast screen: header, phase stepper, a row of four stat cards, then the chart beside a side panel. Below 900px the side panel stacks under the chart.
- The side panel follows the roast and shows only what the moment needs: not connected, the next action (Connect) then the setup card, no outputs; before a roast, setup, then the next action, then outputs; during and after a roast, the next action, the outputs, then the setup. The setup card folds into one row: what the roast is of, a chevron, and an Auto Switch that stays live. Drum, filter fan and bean cooler are one row of labelled Switches. The bean cooler (the tray fan) cools the beans; the fan through the drum cools the drum: copy never calls either one just "cooling". The side panel and the chart column scroll on their own.
- After a roast, its weights, rating and notes sit in a card over the chart that says Saved as each lands; Done hides it.
- Tables sit inside a card with `border` rules between rows and no outer border.
- List-and-detail screens (History, Beans, Profiles, Roasters, Settings) use SidebarLayout: a `sidebar`-wide (256px) column with the title and a NavList, the open item on the right; the two scroll separately.
- Top bar: the mark, the tabs, Emergency stop. Connection is a dot on the Roasters tab: `ink-muted` not connected, `air` connected, `heat` connecting or reconnecting.
- Scrollbars are thin: a `border-strong` thumb on a transparent track, in both themes; never the light system gutter.
- Every screen follows one pattern: the title, with the list's rare actions in a "⋯" Menu beside it (History: Export CSV, Import; Beans: Batch calculator, Show archived; Logs: Open log folder); then filters in one row of FilterSelect chips; then the list. The open item has one header row: its name as the title with its badges, its one or two main actions, and "⋯" for the rest (Delete last, in red, asked in a dialog).
  - Profiles: Save or Use for Auto (or an AUTO badge), ⋯ Duplicate, Copy, Delete.
  - History: Compare ▾, Make profile ▾, ⋯ Delete.
  - Beans: Roast this bean, Add stock, ⋯ Adjust stock, Edit, Make a profile, Archive.
  - Roasters: ⋯ Use this roaster, Delete; Connect stays the big action under the header.
- Every dropdown opens one panel (Select): fields, filter chips and "⋯" menus alike; never the system popup. Long lists (more than 8) get a search box; options may carry one detail line.
- Settings are rows in a card: name and a one-line hint on the left, a Switch or SegmentedControl on the right.

## Charts

| Series                    | Token           | Style                           |
| ------------------------- | --------------- | ------------------------------- |
| Live temperature          | `heat`          | 3.5px solid                     |
| Target curve              | `target`        | 2px dashed 6 6                  |
| Rate of rise (right axis) | `air`           | 2px solid                       |
| Ghost temperature and RoR | `ghost`         | 2px solid, behind live          |
| First crack, drop markers | `ink` / `ghost` | 1.5px dashed vertical, labelled |
| Drop temperature line     | `critical-text` | 1px dotted                      |
| Grid                      | `border`        | 1px                             |

Always show a legend above the chart. Axis labels use `label` in `ink-muted`.

## Iconography

Lucide icons (shadcn/ui's default set), 20px, 2px stroke, `currentColor`. No emoji, no filled icon styles. Icon-only buttons need an `aria-label`.

## Components

Mark, Button, StatCard, OutputControl, CoachCard, PhaseStepper, AlertBanner, RoastChart, RoastStrip, TextField, Select, SelectField, FilterSelect, Switch, SegmentedControl, RoastList, EventTable, NavList, SidebarLayout, ErrorState, Menu and ConfirmDialog. Each has guidelines and a live preview in Components.

## Using it with shadcn/ui and Tailwind

Map the tokens to shadcn's CSS variables once, in `globals.css`:

| shadcn variable                      | Roastpilot token        |
| ------------------------------------ | ----------------------- |
| `--background`                       | `bg`                    |
| `--card`, `--popover`                | `surface`               |
| `--muted`, `--accent`, `--secondary` | `surface-raised`        |
| `--foreground`, `--card-foreground`  | `ink`                   |
| `--muted-foreground`                 | `ink-muted`             |
| `--primary` / `--primary-foreground` | `heat-fill` / `on-heat` |
| `--destructive`                      | `critical`              |
| `--border`, `--input`                | `border`                |
| `--ring`                             | `focus`                 |
| `--radius`                           | `radius-md`             |

Extra roles (`heat`, `air`, `target`, `ghost`, `good`, `warning`) become Tailwind colours in `tailwind.config` so components can use `text-heat` or `stroke-air`.
