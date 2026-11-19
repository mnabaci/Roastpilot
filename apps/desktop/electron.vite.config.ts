import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Workspace packages are devDependencies, so electron-vite bundles their TypeScript source
// instead of loading them from node_modules at runtime. Renderer libraries (React, Zustand, icons,
// dnd-kit) are devDependencies for the same reason: Vite bundles them into the renderer. Only what
// main loads at runtime (serialport, electron-updater) is a dependency, because electron-builder
// copies every dependency into app.asar.
export default defineConfig({
  main: {},
  preload: {
    // Sandboxed preload scripts must be CommonJS.
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
  },
});
