# Toast

A one-line note (the `Toaster` component), bottom-right of the window, for an action that failed (or finished) where the screen itself shows nothing.

## Anatomy

- **Card**: `surface-raised`, 1px border, `radius-lg`, `space-4` padding on the left and 4px elsewhere, so the × close button sits flush right; `space-2` between icon, text and ×.
- **Icon** (20px, Lucide): CircleAlert in `warning` for error, CircleCheck in `good` for success, Info in `ink-muted` for info.
- **Text**: one line of `body` in `ink`: verb + what + next step.
- **Dismiss**: icon-only ghost button (X in `ink-muted`, `ink` on hover), 44px target, `aria-label="Dismiss"`.

## Kinds

- **Error**: `warning` border and icon. Stays until dismissed with ×. `role="alert"`.
- **Info / success**: `border-strong` border. Shows for 4 s, then fades out in 200 ms (no fade with reduced motion); hover or keyboard focus pauses it. `role="status"`.

## Copy

- Sentence case, one line: "Couldn't delete the roast · try again", "Couldn't open the log folder · try again", "Copied".
- Verb first, then what, then the next step after a `·`. No codes, no stack traces: the full error is in Logs.

## Placement

- Bottom-right, `space-6` from the edges, at most 448px wide, so a one-line toast stays on one line. Stacked with `space-2` between, newest at the bottom, at most 3 visible (older ones drop off).
- On the Roast screen it sits over the chart, left of the side panel: it never covers the roast numbers, the flow buttons or the output sliders.

## Do

- Use it when a click's result would otherwise go unseen: a save, delete, connect, copy or export that failed.
- Keep logging the failure as well: the toast is for the person, the log is for the record.

## Don't

- Never for safety: trips, the heater lock and Emergency stop stay red `AlertBanner`s.
- Never for something the screen already says inline (a refused Save under its form, a field hint).
- Never a modal, never something to press to carry on a roast; no actions besides ×.

## Accessibility

- Error: `role="alert"` (announced at once). Info/success: `role="status"` (polite).
- × is a real button with `aria-label="Dismiss"`, focus ring, 44px target.
- Timed toasts pause while hovered or focused, so they can be read and reached by keyboard.
- Text 4.5:1 (`ink` on `surface-raised`) in both themes; the border is decoration, the icon has `aria-hidden`.
