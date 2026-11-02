# apps/desktop

The Electron app. May import every package.

## Rules

- `main` is the composition root: it creates the driver, controller, storage and registries and wires them. Business rules live in `core`, not here.
- All roaster control runs in `main`. The renderer only displays data and sends requests through the typed preload API.
- IPC channels and payloads come from `@roastpilot/shared`; validate every payload with its zod schema.
- `contextIsolation` on, `nodeIntegration` off, no remote content.
- Renderer: screens are compositions of `@roastpilot/ui` components. Feature state in small Zustand stores. No hex colours.
- On quit or crash paths, send safe-stop before anything else.
