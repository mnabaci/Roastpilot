# Tech stack

TypeScript end to end, chosen for a small, typed, testable desktop app. Exact versions live in
the `package.json` files and `pnpm-lock.yaml`.

| Layer              | Choice                                                              | Why                                                                           |
| ------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Workspace          | pnpm workspaces                                                     | Strict dependencies, fast installs                                            |
| Build and dev      | electron-vite                                                       | Fast hot reload for main, preload and renderer                                |
| Packaging          | electron-builder                                                    | macOS DMG and Windows NSIS installer; rebuilds native modules for Electron    |
| UI                 | React + Tailwind CSS v4 + shadcn/ui                                 | Components you own and edit; design tokens become the Tailwind theme          |
| Component workshop | Storybook (React + Vite, a11y and themes addons)                    | Every component built and reviewed in isolation, in both themes               |
| Charts             | uPlot                                                               | Fast live time series, two y-axes for temp and RoR                            |
| Drag to reorder    | dnd-kit (core, sortable; ADR 0022)                                  | Floating row, drop placeholder, sliding rows, keyboard and announcements      |
| UI state           | Zustand                                                             | Small stores fed by IPC events, little boilerplate                            |
| IPC                | Typed contract in `packages/shared` + zod                           | One source of truth for channels; payloads validated at the boundary          |
| Serial             | serialport                                                          | Used only inside `SerialTransport`                                            |
| Database           | `node:sqlite` + Drizzle (ADR 0010)                                  | Typed schema and generated migrations behind the repositories                 |
| Tests              | Vitest + Testing Library (jsdom)                                    | Logic tested in Node, React components in jsdom; v8 coverage                  |
| Language           | TypeScript 6, strict                                                | TypeScript 7 waits until typescript-eslint supports it                        |
| Code quality       | ESLint 9 (type-aware, boundaries, React hooks, jsx-a11y) + Prettier | Boundaries, hook rules, accessibility and token-only colours enforced by lint |
| Commits            | commitlint + husky + lint-staged                                    | Conventional commits, checks before every commit                              |
| Dependencies       | Dependabot, weekly, grouped                                         | Small regular updates instead of big upgrades                                 |

`serialport` is a native module. `pnpm dev` runs electron-builder's `install-app-deps` first,
which rebuilds it for Electron. Storage uses the built-in `node:sqlite`, so it needs no build.

## TypeScript setup

- `tsconfig.base.json`: strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (no enums or namespaces), bundler resolution, no implicit `@types`.
- Each package picks its runtime: `core` and `shared` get plain ES only (no DOM, no Node), `drivers` and `storage` add Node types, `ui` adds DOM and React JSX.
- `apps/desktop` has two configs: `tsconfig.node.json` for main and preload (Node + Electron) and `tsconfig.web.json` for the React renderer (DOM + Vite).
- Config files, scripts and agent hooks are TypeScript too: the root `tsconfig.json` type-checks them, and Node 22.22+ and 24 run `.ts` files directly.
- Workspace packages export TypeScript source; electron-vite bundles them, so there is no per-package build.

## Cross-platform

- The serial port is picked from a list (`/dev/cu.usbserial-…` on macOS, `COMx` on Windows).
- Paths always via `node:path` and Electron's `app.getPath`; no hard-coded separators.
- Line endings are LF everywhere (`.gitattributes`); agent hooks are Node scripts, not shell.
- CI runs on Ubuntu and Windows.
