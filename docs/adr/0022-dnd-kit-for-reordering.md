# 0022: dnd-kit for reordering rows

Status: accepted
Date: 2026-11-09

## Context

The profile editor's steps move by a ⠿ handle (docs/spec/ui.md, Moving a step). It used the browser's native HTML5 drag and drop. It worked, but the user could not see where a step would land: the browser's drag image is a faint snapshot, nothing marks the gap, the other rows don't move, and the native drag can't be styled with our tokens. The user asked for a visible drop target, a copy of the row under the cursor and some animation, and approved a library for it.

Options:

- **Native HTML5 drag and drop, by hand.** No dependency, but the drag image, drop indicator, row animations, Escape, auto-scroll and screen-reader announcements are all ours to build and test; the drag image still can't follow our theme.
- **Pragmatic drag and drop (Atlassian).** Small and fast, but it sits on the native drag: the preview is still the browser's image, and the drop indicator, animations and keyboard moves are separate packages or ours to write.
- **dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`).** Pointer-event based: a `DragOverlay` we render (so it uses tokens), sortable lists whose rows slide to make room, a keyboard sensor (Space to pick up, arrows, Space to drop, Escape to cancel), live-region announcements we can word, modifiers to keep the drag on one axis and inside the list. MIT, React only, no runtime dependencies besides `tslib`; with our wiring it adds about 27 kB gzipped to the renderer bundle (389 kB to 416 kB). Works on table rows with CSS transforms.

## Decision

Use dnd-kit's stable packages (`core` 6, `sortable` 10, `utilities` 3) in the renderer (`apps/desktop`), for the steps table first. Only the steps between Soak and the last step are sortable items, so nothing can be dropped outside them. The drop still goes through `moveStep`, so the draft and its checks don't change. Alt+↑ / Alt+↓ on the handle stay as they were. The modifier we need (up and down only, inside the table) is a few lines of ours, so `@dnd-kit/modifiers` isn't added.

The library stays in the steps table's own files (`StepsTable`, `SortableStep`, `use-step-drag`, `step-drag`); nothing else imports it. If a second screen needs reordering, a `Sortable` wrapper moves to `packages/ui` then.

## Consequences

- A floating copy of the row under the cursor, a faint placeholder where it will land, rows that slide (off with `prefers-reduced-motion`), Escape to cancel, and screen-reader announcements, without our own drag engine.
- Three more runtime dependencies (Dependabot covers them). `@dnd-kit/core` 6 has been stable for years while its authors build a new major (`@dnd-kit/react`); if 6 stops getting fixes, the swap is contained to the hook and the table.
- Tests drive the drag with dnd-kit's keyboard sensor in jsdom (pointer drags need layout, which jsdom lacks); the pointer path is checked in the real app (`ui-check`).
