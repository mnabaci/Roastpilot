// Generates src/styles/tokens.css (CSS variables per theme) and src/styles/theme.css (the
// Tailwind v4 theme) from tokens.json, which is synced from the Roastpilot design system.
// Run with `pnpm --filter @roastpilot/ui tokens`. Never edit the generated files by hand.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
interface ColorToken {
  name: string;
  value: string | Record<string, string>;
}
interface ScaleToken {
  name: string;
  value: string;
}
interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight?: string | number;
  fontWeight?: number | string;
  letterSpacing?: string;
}
interface Tokens {
  name: string;
  color: { themes: { id: string }[]; tokens: ColorToken[] };
  type: { families: Record<string, string>; groups: { styles: TypeStyle[] }[] };
  spacing?: { tokens: ScaleToken[] };
  radius: { tokens: ScaleToken[] };
  size?: { tokens: ScaleToken[] };
}

const tokens = JSON.parse(readFileSync(new URL('tokens.json', root), 'utf8')) as Tokens;

const themes = tokens.color.themes.map((t) => t.id);
const [firstTheme] = themes;
if (!firstTheme) throw new Error('tokens.json defines no colour themes');
const value = (v: string): string =>
  typeof v === 'string' ? v.replace(/^\{(.+)\}$/, 'var(--$1)') : v;
const colorsFor = (theme: string): string =>
  tokens.color.tokens
    .map((t) => {
      const raw =
        typeof t.value === 'string' ? t.value : (t.value[theme] ?? t.value[firstTheme] ?? '');
      return `  --${t.name}: ${value(raw)};`;
    })
    .join('\n');

const scale = [...(tokens.spacing?.tokens ?? []), ...(tokens.size?.tokens ?? [])]
  .map((t) => `  --${t.name}: ${t.value};`)
  .join('\n');

const fonts = Object.entries(tokens.type.families)
  .map(([key, stack]) => `  --font-${key}: ${stack};`)
  .join('\n');
// Type styles become text utilities: text-readout-xl sets size, line height, weight and tracking.
const typeStyles = tokens.type.groups
  .flatMap((group) => group.styles)
  .map((style) =>
    [
      `  --text-${style.name}: ${style.fontSize};`,
      style.lineHeight === undefined
        ? ''
        : `  --text-${style.name}--line-height: ${String(style.lineHeight)};`,
      style.fontWeight === undefined
        ? ''
        : `  --text-${style.name}--font-weight: ${String(style.fontWeight)};`,
      style.letterSpacing === undefined
        ? ''
        : `  --text-${style.name}--letter-spacing: ${style.letterSpacing};`,
    ]
      .filter(Boolean)
      .join('\n'),
  )
  .join('\n');

// Control sizes become spacing utilities: h-control-lg, min-h-control-sm, ...
const controlSizes = (tokens.size?.tokens ?? [])
  .map((t) => `  --spacing-${t.name}: ${t.value};`)
  .join('\n');

const radii = tokens.radius.tokens.map((t) => `  --${t.name}: ${t.value};`).join('\n');
const colorUtilities = tokens.color.tokens
  .map((t) => `  --color-${t.name}: var(--${t.name});`)
  .join('\n');

const css = [
  `/* ${tokens.name}: generated from tokens.json. Do not edit. */`,
  `:root,\n[data-theme='${firstTheme}'] {\n${colorsFor(firstTheme)}\n}`,
  ...themes.slice(1).map((id) => `[data-theme='${id}'] {\n${colorsFor(id)}\n}`),
  `:root {\n${scale}\n}`,
].join('\n\n');

// Fonts and radii become Tailwind theme values (font-sans, rounded-md, ...); colours become
// utilities that follow the active theme (bg-surface, text-ink-muted, stroke-heat, ...).
const theme = [
  `/* ${tokens.name}: generated from tokens.json. Do not edit. */`,
  `@theme {\n${fonts}\n${radii}\n${typeStyles}\n${controlSizes}\n}`,
  `@theme inline {\n${colorUtilities}\n}`,
].join('\n\n');

writeFileSync(new URL('src/styles/tokens.css', root), `${css}\n`);
writeFileSync(new URL('src/styles/theme.css', root), `${theme}\n`);
console.log('Wrote src/styles/tokens.css and src/styles/theme.css');
