import type { Linter } from 'eslint';
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import storybook from 'eslint-plugin-storybook';
import globals from 'globals';

/** Packages, as seen by the boundary rules. */
const elements = [
  { type: 'shared', pattern: 'packages/shared/**' },
  { type: 'core', pattern: 'packages/core/**' },
  { type: 'drivers', pattern: 'packages/drivers/**' },
  { type: 'storage', pattern: 'packages/storage/**' },
  { type: 'ui', pattern: 'packages/ui/**' },
  { type: 'desktop', pattern: 'apps/desktop/**' },
];

/** Who may import whom. Keep in sync with AGENTS.md and docs/spec/repository.md. */
const allowedImports: Record<string, string[]> = {
  shared: [],
  core: ['shared'],
  drivers: ['core', 'shared'],
  storage: ['core', 'shared'],
  ui: ['shared'],
  desktop: ['core', 'drivers', 'storage', 'shared', 'ui'],
};

const reactFiles = ['packages/ui/src/**/*.{ts,tsx}', 'apps/desktop/src/renderer/**/*.{ts,tsx}'];

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/storybook-static/**',
      '!packages/ui/.storybook',
      'firmware/**',
      'packages/ui/src/styles/**',
      '.remember/**',
      // Agents' temporary git worktrees: separate checkouts, not this tree's code.
      '.claude/worktrees/**',
    ],
  },

  // Base rules for all JS and TS.
  js.configs.recommended,

  // TypeScript: strict and type-aware (catches floating promises, unsafe any, ...).
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  // Plain JS files (config and scripts) run in Node and are not type-checked.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // Electron main and preload run in Node.
  {
    files: [
      'apps/desktop/src/main/**',
      'apps/desktop/src/preload/**',
      'apps/desktop/src/screenshots/**',
      'apps/desktop/.storybook/**',
      '**/*.config.ts',
    ],
    languageOptions: { globals: globals.node },
  },

  // React: hooks rules, accessibility, browser globals.
  {
    files: reactFiles,
    extends: [reactHooks.configs.flat['recommended-latest'], jsxA11y.flatConfigs.recommended],
    languageOptions: { globals: globals.browser },
  },

  // Fast refresh only works when component files export components.
  {
    files: ['apps/desktop/src/renderer/**/*.tsx'],
    extends: [reactRefresh.configs.vite],
  },

  // Package boundaries.
  {
    files: ['apps/**', 'packages/**'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'boundaries/include': ['apps/**', 'packages/**'],
      'import/resolver': {
        typescript: {
          project: ['packages/*/tsconfig.json', 'apps/desktop/tsconfig.*.json'],
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

  // App code: log through the injected Logger, and never drop a promise's error (docs/spec/errors-and-logging.md).
  {
    files: ['packages/*/src/**/*.{ts,tsx}', 'apps/desktop/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/*.stories.{ts,tsx}'],
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
    },
  },

  // Only the desktop app talks to Electron.
  {
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

  // core and shared stay pure: no Electron, no Node I/O, no network, no native modules.
  {
    files: ['packages/core/src/**/*.ts', 'packages/shared/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['electron', 'electron/*'], message: 'Only apps/desktop may use Electron.' },
            {
              group: ['node:*', 'fs', 'path', 'os', 'child_process', 'net', 'http', 'https'],
              message: 'core and shared must stay free of I/O.',
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

  // Colours come from design tokens only (packages/ui/tokens.json).
  {
    files: reactFiles,
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

  // Storybook stories follow the CSF rules.
  // The plugin's own types don't line up with defineConfig yet.
  ...(storybook.configs['flat/recommended'] as Linter.Config[]),

  // Tests may be looser.
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      // `expect(api.connect).toHaveBeenCalled()` reads a mock, it never calls it unbound.
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  // Formatting is Prettier's job; turn off rules that conflict with it. Keep last.
  prettier,
);
