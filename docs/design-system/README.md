# Roastpilot

This folder is the source of truth ([ADR 0020](../adr/0020-design-system-in-the-repo.md)).
Change it in the same PR as the component.
The claude.ai page is generated from it with `/design-sync`.

Roastpilot is a desktop app that roasts coffee on autopilot and coaches you when you take the controls. This design system keeps every screen dark, precise and readable from a step back from the roaster: graphite surfaces, an ember accent for heat and cyan for air.

## Principles

- **One obvious next action.** Each roast phase shows one primary button (`control-lg`, `heat-fill`, with an icon). Everything else is secondary.
- **Numbers, not sentences.** Live state is a big readout (`readout-xl`) with a small label. Helper text is one line of `body` in `ink-muted`.
- **Readable from 1–2 m.** Readouts are 56px, labels 13px minimum, touch targets 44px minimum.
- **Never block the roast.** Alerts are banners plus sound, never dialogs. The one dialog is a confirmation the user opened with their own click (ConfirmDialog); Escape or Cancel closes it.
- **Colour means something.** Ember is heat, cyan is air, grey is reference. State colours appear only for real states.

## Voice and copy

- Sentence case everywhere except badges (`AUTO`, `MANUAL`, `BUILT-IN`).
- Lead with the value, then the unit with a space: `212 °C`, `9.4 °C/min`, `375 g`, `1:58`. Temperatures follow Settings › Appearance › Temperature: in °F the same rule reads `414 °F`, `16.9 °F/min`, a temperature whole ([ui.md](../spec/ui.md#units)).
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
| Chart ground | `band-low`, `band-mid`, `band-high`, `chart-grid`                  | Phase bands behind the curves; the chart grid      |
| State        | `good`, `warning`, `critical`, `critical-text`, `critical-surface` | Connected, low stock, safety                       |
| Focus        | `focus`                                                            | 2px ring, 2px offset, on every control             |

Rules:

- `heat-fill` is for the one primary action per screen and the heater slider. Never for decoration.
- `critical` (the fill) is reserved for Emergency stop and safety trips. Delete buttons use `critical-text` as text only, never a red fill, so a red block still always means safety.
- Ember and cyan sit on opposite sides of the colour wheel and differ in lightness, so they stay distinct for colour-blind users.
- Neutrals are cool graphite with no brown or cream: warmth comes only from the ember accent.

## Elevation

Flat by default: cards sit on `bg` by colour, not shadow. `shadow-raised` (a soft drop shadow, heavier in Dark) is only for something lifted off the page while you hold it, such as a dragged row. Use it as `shadow-(--shadow-raised)`.

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
- The side panel follows the roast and shows only what the moment needs: not connected, the next action (Connect) then the setup card, no outputs; before a roast, setup, then the next action, then outputs; during and after a roast, the next action, the outputs, then the setup. The setup card is a CollapsibleCard whose header row is what the roast is of (a Needs calibration badge under it), then an Auto Switch that stays live, then the chevron. Drum, filter fan and bean cooler are one row of labelled Switches. The bean cooler (the tray fan) cools the beans; the fan through the drum cools the drum: copy never calls either one just "cooling". The side panel and the chart column scroll on their own.
- Profile editor: header, top values, then the Preview chart right under them (what you shape stays in view), then the tables. A curve profile's Steps and Curve points sit side by side from 1280px (`xl`), Steps two thirds, Curve points one third, `space-4` apart; below that they stack, Steps first. A step profile's Steps take the full width.
- Rows you can reorder (the profile editor's steps) have a ⠿ handle in a first column: a ghost `sm` icon button (Lucide `GripVertical`, `ink-muted`, 44px square, `aria-label` "Move <name>"). Rows that can't move (Soak, Development) leave the cell empty, and nothing drops above or below them; a read-only table has no handle column.
  - Drag: a press moves 4px before it lifts, so a click stays a click. The row floats under the cursor as a copy on `surface-raised`, `radius-md`, `shadow-raised`, its values readable, up and down only and inside the table. Where it will land is a placeholder at 30% opacity edged by a 2px `heat` outline; the other rows slide out of the way in 150ms (ease) and the copy settles into its place the same way. With reduced motion nothing slides: rows jump. Escape puts it back.
  - Keys: Alt+↑ / Alt+↓ on the handle move one place, focus stays on the handle and a polite live line says where it went. Space (or Enter) picks it up, ↑ / ↓ carry it, Space drops, Escape cancels, each step announced.
- In the steps table a field never clips its value: each has a minimum width (times `18`, RoR `11`, others `13` spacing units); below 1280px the gap between fields halves (8px to 4px) and a header may wrap ("RoR / min") so the table fits a 960px window.
- After a roast, its weights, rating and notes sit in a card over the chart that says Saved as each lands; Done hides it.
- Weights, rating and notes look the same wherever they're edited (that card, and History's Roast details, a CollapsibleCard under the stat cards): Green and Roasted side by side with the loss between them as a quiet readout (`14.3 %` over `loss`), the 1–5 rating (StarRating) and the favourite heart as one group under a Rating label, Notes a TextAreaField that grows with its text.
- Tables sit inside a card with `border` rules between rows and no outer border.
- Facts (a record's fields) sit in a card as tiles: a `label` name in `ink-muted` over a `body` value, in a grid whose columns follow the card's width (container queries: 3, then 4, then 6), so a wide window shows them in one row instead of a tall list. Hints go at the card's foot under a `border` rule, `label` `ink-muted` after a Lucide light-bulb icon.
- List-and-detail screens (History, Beans, Profiles, Roasters, Settings) use SidebarLayout: a `sidebar`-wide (256px) column with the title and a NavList, the open item on the right; the two scroll separately.
- Top bar: the mark, the tabs, Emergency stop. Connection is a dot on the Roasters tab: `ink-muted` not connected, `air` connected, `heat` connecting or reconnecting.
- Scrollbars are thin: a `border-strong` thumb on a transparent track, in both themes; never the light system gutter.
- Every screen follows one pattern: the title, with the list's rare actions in a "⋯" Menu beside it (Export all and Import a Roastpilot file on History, Beans, Profiles and Roasters; Beans: Batch calculator, Show archived; Logs: Open log folder); then filters in one row of FilterSelect chips; then the list. The open item has one header row: its name as the title with its badges, its one or two main actions, and "⋯" for the rest (Delete last, in red, asked in a dialog).
  - Profiles: Use for Auto (or an AUTO badge) and Edit (Duplicate on a built-in); editing, Cancel and Save. ⋯ Duplicate (own profiles), Copy, Mark as calibrated, Export this profile, Delete (disabled, with why, on the one Auto uses or runs). Title ⋯: New from milestones, Export all, Import a Roastpilot file, Select.
  - History: Compare ▾, Make profile ▾, ⋯ Export this roast, Delete. Title ⋯: Export all, Import a Roastpilot file, Import from Artisan, Select. The header row never wraps: Compare's choice truncates first (its whole date in a Tooltip), then Make profile; the title keeps its place.
  - Beans: Roast this bean, Add stock, Order again, Edit, ⋯ Adjust stock, Make a profile, Export this bean, Archive. Title ⋯: Batch calculator, Show archived, Export all, Import a Roastpilot file, Select.
  - Roasters: Use this roaster (not on the active one), Connect (`sm`, primary) or Disconnect, Edit, ⋯ Export this roaster, Delete. A compact connection card sits under the header: state, port, Change port and Refresh. Title ⋯: Export all, Import a Roastpilot file, Select.
- An action not allowed right now stays where it is, dimmed (`aria-disabled`, still focusable), with why in a Tooltip on hover or keyboard focus: menus and headers keep their shape. A "⋯" item is its name only.
- An item being edited (a bean, a profile, a roaster) opens read, values as text; Edit in its header turns them into fields, and Cancel and Save take the header's right end. Never Save at a page's foot.
- Everything you can click shows the pointer cursor; anything disabled, `not-allowed` (globals.css).
- Select mode is the same on every list: the list's ⋯ › Select, tick boxes (a lock on rows that can't be ticked), and one bar: the count, Export, Delete or Archive, Done.
- A rating is StarRating everywhere: five stars, never `4/5`.
- Every dropdown opens one panel (Select): fields, filter chips and "⋯" menus alike; never the system popup. Long lists (more than 8) get a search box; options may carry one detail line.
- Settings are rows in a card: name and a one-line hint on the left, a Switch or SegmentedControl on the right.

## Charts

| Series                    | Token                               | Style                            |
| ------------------------- | ----------------------------------- | -------------------------------- |
| Live temperature          | `heat`                              | 3.5px solid                      |
| Target curve              | `target`                            | 2px dashed 6 6                   |
| Rate of rise (right axis) | `air`                               | 2px solid                        |
| Ghost temperature and RoR | `ghost`                             | 2px solid, behind live           |
| Compared roast's outputs  | `heat`, `air`, `ink-muted`          | 2px dashed 4 4, 55 % opacity     |
| First crack, drop markers | `ink` / `ghost`                     | 1.5px dashed vertical, labelled  |
| Drop temperature line     | `critical-text`                     | 1px dotted                       |
| Phase bands               | `band-low`, `band-mid`, `band-high` | Full-width fills behind the grid |
| Grid                      | `chart-grid`                        | 1px, translucent                 |

Always show a legend above the chart. Axis labels use `label` in `ink-muted`.

## Iconography

Lucide icons (shadcn/ui's default set), 20px, 2px stroke, `currentColor`; inline in `label` text (StarRating's shown stars) 14px. No emoji, no filled icon styles. Icon-only buttons need an `aria-label`.

## Components

Mark, Button, Badge, StatCard, OutputControl, CoachCard, PhaseStepper, AlertBanner, Toast, RoastChart, RoastStrip, TextField, NumberField, Select, SelectField, FilterSelect, Switch, SegmentedControl, RoastList, EventTable, CompareTable, RoastTable, StarRating, NavList, SidebarLayout, CollapsibleCard, TextAreaField, ErrorState, Menu, ConfirmDialog, Dialog and Tooltip. Each has its guidelines in `components/<Name>/README.md` and, where one is drawn, a static preview beside it (`preview.html`); the live components are in Storybook (`pnpm storybook`).

## Files

- `README.md` (this brand book) and `components/<Name>/README.md`: the guidelines.
- `components/<Name>/preview.html`: a static drawing of the component in plain HTML and CSS, using the token variables. The claude.ai page shows them with its tokens; opened as a file, they take the colours and spacing from `packages/ui/src/styles/tokens.css` (corners and the font fall back to the browser's). No build step.
- Tokens: `packages/ui/tokens.json`, the only copy. `pnpm --filter @roastpilot/ui tokens` regenerates the CSS from it.

## Using it in code

The components are in `packages/ui` (shadcn/ui-style source, Radix primitives, Lucide icons, Tailwind v4). `tokens.json` generates `src/styles/tokens.css` (a CSS variable per token, per theme, under `[data-theme]`) and `src/styles/theme.css` (the Tailwind theme), so every token is a utility: `bg-surface-raised`, `text-heat`, `text-readout-xl`, `h-control-sm`, `rounded-xl`, `w-sidebar`. Components use these only: no hex colours, no magic sizes.
