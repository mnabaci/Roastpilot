# PhaseStepper

Shows where the roast is: Preheat, Roast, First crack, Drop, Cool.

## States

- Done: `good` dot, `ink` label.
- Current: `heat-fill` dot, `ink` label at 600.
- Upcoming: `border-strong` dot, `ink-muted` label.

## Rules

- An ordered list (`<ol>`) for screen readers; wraps on narrow screens.
- Dots are 10px, `radius-full`; gap 28px between steps.
- Each step name reserves its 600-weight width, so later steps never shift when the current one turns bold.
