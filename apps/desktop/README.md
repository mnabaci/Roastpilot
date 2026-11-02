# @roastpilot/desktop

The Roastpilot Electron app, built with electron-vite.

- `src/main`: composition root and IPC handlers (runs the roaster)
- `src/preload`: the typed bridge the renderer calls
- `src/renderer`: React UI built from `@roastpilot/ui`

```sh
pnpm dev        # from the repo root: rebuilds native modules for Electron, then starts the app
pnpm dist:mac   # in this folder: build a macOS DMG
```
