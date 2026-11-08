import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Two test environments: plain Node for logic packages, jsdom for React code.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'packages/{core,shared,drivers,storage}/src/**/*.test.ts',
            'apps/desktop/src/{main,preload}/**/*.test.ts',
            'scripts/**/*.test.ts',
          ],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'dom',
          environment: 'jsdom',
          // One jsdom per worker, shared by its test files: about 3x faster. Safe because UI tests
          // never vi.mock a module (they inject, e.g. PlotEngineProvider) and the setup file puts
          // back what a test changed.
          isolate: false,
          setupFiles: ['./vitest.setup.dom.ts'],
          include: [
            'packages/ui/src/**/*.test.{ts,tsx}',
            'apps/desktop/src/renderer/**/*.test.{ts,tsx}',
            'apps/desktop/src/screenshots/**/*.test.{ts,tsx}',
          ],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/desktop/src/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/index.ts'],
    },
  },
});
