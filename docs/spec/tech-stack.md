# Tech stack

TypeScript end to end, chosen for a small, typed, testable desktop app. Exact versions live in
the `package.json` files and `pnpm-lock.yaml`.

| Layer         | Choice                                           | Why                                                                           |
| ------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Workspace     | pnpm workspaces                                  | Strict dependencies, fast installs                                            |
| Build and dev | electron-vite                                    | Fast hot reload for main, preload and renderer                                |
| Packaging     | electron-builder                                 | macOS DMG; rebuilds native modules for Electron                               |
| UI            | React + Tailwind CSS v4 + shadcn/ui              | Components you own and edit; design tokens become the Tailwind theme          |
| Charts        | uPlot                                            | Fast live time series, two y-axes for temp and RoR                            |
| UI state      | Zustand                                          | Small stores fed by IPC events, little boilerplate                            |
| IPC           | Typed contract in `packages/shared` + zod        | One source of truth for channels; payloads validated at the boundary          |
| Serial        | serialport                                       | Used only inside `SerialTransport`                                            |
| Database      | better-sqlite3 + Drizzle                         | Typed schema and generated migrations behind the repositories                 |
| Tests         | Vitest                                           | PID, state machine, safety rules and drivers tested against `SimulatedDriver` |
| Code quality  | ESLint (incl. boundaries) + Prettier + strict TS | Package boundaries and token-only colours enforced by lint                    |

`serialport` and `better-sqlite3` are native modules. `pnpm dev` runs electron-builder's
`install-app-deps` first, which rebuilds them for Electron.
