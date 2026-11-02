// Generates src/styles/tokens.css (CSS variables per theme) and src/styles/theme.css (the
// Tailwind v4 theme) from tokens.json, which is synced from the Roastpilot design system.
// Run with `pnpm --filter @roastpilot/ui tokens`. Never edit the generated files by hand.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const tokens = JSON.parse(readFileSync(new URL('tokens.json', root), 'utf8'));

const themes = tokens.color.themes.map((t) => t.id);
const value = (v) => (typeof v === 'string' ? v.replace(/^\{(.+)\}$/, 'var(--$1)') : v);
const colorsFor = (theme) =>
  tokens.color.tokens
    .map((t) => {
      const raw = typeof t.value === 'string' ? t.value : (t.value[theme] ?? t.value[themes[0]]);
      return `  --${t.name}: ${value(raw)};`;
    })
    .join('\n');

const scale = ['spacing', 'size']
  .flatMap((family) => tokens[family]?.tokens ?? [])
  .map((t) => `  --${t.name}: ${t.value};`)
  .join('\n');

const fonts = Object.entries(tokens.type.families)
  .map(([key, stack]) => `  --font-${key}: ${stack};`)
  .join('\n');
const radii = tokens.radius.tokens.map((t) => `  --${t.name}: ${t.value};`).join('\n');
const colorUtilities = tokens.color.tokens
  .map((t) => `  --color-${t.name}: var(--${t.name});`)
  .join('\n');

const css = [
  `/* ${tokens.name}: generated from tokens.json. Do not edit. */`,
  `:root,\n[data-theme='${themes[0]}'] {\n${colorsFor(themes[0])}\n}`,
  ...themes.slice(1).map((id) => `[data-theme='${id}'] {\n${colorsFor(id)}\n}`),
  `:root {\n${scale}\n}`,
].join('\n\n');

// Fonts and radii become Tailwind theme values (font-sans, rounded-md, ...); colours become
// utilities that follow the active theme (bg-surface, text-ink-muted, stroke-heat, ...).
const theme = [
  `/* ${tokens.name}: generated from tokens.json. Do not edit. */`,
  `@theme {\n${fonts}\n${radii}\n}`,
  `@theme inline {\n${colorUtilities}\n}`,
].join('\n\n');

writeFileSync(new URL('src/styles/tokens.css', root), `${css}\n`);
writeFileSync(new URL('src/styles/theme.css', root), `${theme}\n`);
console.log('Wrote src/styles/tokens.css and src/styles/theme.css');
