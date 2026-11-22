import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Workspace packages are devDependencies, so electron-vite bundles their TypeScript source
// instead of loading them from node_modules at runtime. Renderer libraries (React, Zustand, icons,
// dnd-kit) are devDependencies for the same reason: Vite bundles them into the renderer. Only what
// main loads at runtime (serialport, electron-updater, the AI helpers' @anthropic-ai/sdk and
// @typesafe-ai/sdk, and zod, which the Claude SDK's structured output loads) is a dependency,
// because electron-builder copies every dependency into app.asar.
export default defineConfig({
  main: {},
  preload: {
    // Sandboxed preload scripts must be CommonJS, and can't load packages: zod is a dependency
    // (for main), so bundle it here instead of leaving a require("zod") the sandbox can't run.
    build: {
      externalizeDeps: { exclude: ['zod'] },
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
  },
});
