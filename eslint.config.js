// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';

/** Package dependency rules. Keep in sync with CLAUDE.md and docs/spec. */
const elements = [
  { type: 'shared', pattern: 'packages/shared/**' },
  { type: 'core', pattern: 'packages/core/**' },
  { type: 'drivers', pattern: 'packages/drivers/**' },
  { type: 'storage', pattern: 'packages/storage/**' },
  { type: 'ui', pattern: 'packages/ui/**' },
  { type: 'desktop', pattern: 'apps/desktop/**' },
];

/** Who may import whom. Keep in sync with CLAUDE.md and docs/spec/repository.md. */
const allowedImports = {
  shared: [],
  core: ['shared'],
  drivers: ['core', 'shared'],
  storage: ['core', 'shared'],
  ui: ['shared'],
  desktop: ['core', 'drivers', 'storage', 'shared', 'ui'],
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/out/**', '**/node_modules/**', 'firmware/**', 'coverage/**'] },
  js.configs.recommended,
  {
    // Build scripts and config files run in Node.
    files: [
      '**/*.{js,mjs,cjs}',
      '**/*.config.ts',
      'apps/desktop/src/main/**',
      'apps/desktop/src/preload/**',
    ],
    languageOptions: { globals: globals.node },
  },
  ...tseslint.configs.strict,
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'boundaries/include': ['apps/**', 'packages/**'],
      'import/resolver': {
        typescript: {
          project: ['packages/*/tsconfig.json', 'apps/*/tsconfig.json'],
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // Third-party packages and Node built-ins are governed by the import rules below.
            { allow: { to: { module: { origin: 'external' } } } },
            { allow: { to: { module: { origin: 'core' } } } },
            ...Object.entries(allowedImports).map(([from, to]) => ({
              from: { element: { type: from } },
              allow: { to: { element: { types: { anyOf: [from, ...to] } } } },
            })),
          ],
        },
      ],
    },
  },
  {
    // Colours come from design tokens only (packages/ui/tokens.json).
    files: ['packages/ui/src/**/*.{ts,tsx}', 'apps/desktop/src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]',
          message: 'Use a design token (CSS variable or Tailwind class), not a hex colour.',
        },
      ],
    },
  },
  {
    // Only the desktop app talks to Electron.
    files: ['packages/*/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['electron', 'electron/*'], message: 'Only apps/desktop may use Electron.' },
          ],
        },
      ],
    },
  },
  {
    // core stays pure: no Electron, no Node I/O, no network.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['electron', 'electron/*'], message: 'core must not depend on Electron.' },
            {
              group: ['node:*', 'fs', 'path', 'child_process', 'net', 'http', 'https'],
              message: 'core must stay free of I/O.',
            },
            {
              group: ['serialport', 'better-sqlite3', 'drizzle-orm', 'drizzle-orm/*'],
              message: 'Hardware and storage live in drivers/ and storage/.',
            },
          ],
        },
      ],
    },
  },
);
