# apps/desktop

The Electron app. May import every package.

## Rules

- `main` is the composition root: it creates the driver, controller, storage and registries and wires them. Business rules live in `core`, not here.
- All roaster control runs in `main`. The renderer only displays data and sends requests through the typed preload API.
- IPC channels and payloads come from `@roastpilot/shared`; validate every payload with its zod schema.
- `contextIsolation` on, `nodeIntegration` off, no remote content.
- Renderer: screens are compositions of `@roastpilot/ui` components. Feature state in small Zustand stores. No hex colours.
- On quit or crash paths, send safe-stop before anything else.
- Keep the window locked down: `contextIsolation`, `sandbox`, no `nodeIntegration`, deny new windows and external navigation, strict CSP.

## Renderer layout

```
src/renderer/src/
  app/        App shell, screen switching, providers
  screens/    one folder per screen (Roast, Profiles, History, Beans, Calculator, Settings)
  features/   feature components and hooks shared by screens
  stores/     small Zustand stores, one per concern, fed by window.roastpilot events
  lib/        renderer-only helpers
```

- Function components and hooks only; no class components except an error boundary.
- A component file exports components only (fast refresh); hooks and helpers live in their own files.
- Tests next to the code with Testing Library: test what the user sees and does, not implementation details.
