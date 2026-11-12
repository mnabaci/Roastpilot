import type { KnipConfig } from 'knip';

// Dead-code check (`pnpm knip`, part of `pnpm check`). Knip reads the workspaces, their
// package.json scripts and the Vitest, Storybook, ESLint, Drizzle and electron-vite configs to find
// the entry points; the extra entries below are the ones it cannot see. Tests count as entries, so
// an export used only by a test is not reported (shared test harnesses are named `*.harness.ts`).
const config: KnipConfig = {
  // A package's index.ts is its public API: report what no other workspace imports, so the API
  // stays as small as what is really used.
  includeEntryExports: true,
  // An export the file itself uses (a zod schema behind its `z.infer` type, a helper) is not dead
  // code; only the `export` keyword may be surplus, which is not worth a rule.
  ignoreExportsUsedInFile: true,
  workspaces: {
    '.': {
      entry: ['scripts/*.ts', 'scripts/ui/ui.ts', '.claude/hooks/*.ts'],
    },
    'apps/desktop': {
      // `pnpm icon` runs this through the electron binary, which knip does not follow.
      entry: ['scripts/make-icon.ts'],
      // The drivers package imports serialport, but the desktop app must list it too so
      // electron-builder ships the native module with the app.
      ignoreDependencies: ['serialport'],
    },
  },
};

export default config;
