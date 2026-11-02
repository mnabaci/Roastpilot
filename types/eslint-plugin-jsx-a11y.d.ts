// eslint-plugin-jsx-a11y ships no type declarations.
declare module 'eslint-plugin-jsx-a11y' {
  import type { Linter } from 'eslint';

  const plugin: {
    flatConfigs: Record<'recommended' | 'strict', Linter.Config>;
  };
  export default plugin;
}
