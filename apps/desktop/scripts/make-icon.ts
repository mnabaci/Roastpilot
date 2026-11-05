/**
 * Draws the app icon (design system, Mark) into build/icon.png at 1024 × 1024, from the dark
 * theme's tokens. electron-builder makes the macOS and Windows icons from it; dev uses it for the
 * Dock. Run with `pnpm --filter @roastpilot/desktop icon` after the mark or its colours change.
 */
import { app, BrowserWindow } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEAN_PATH, BEAN_TURN, CUT_PATH } from '../../../packages/ui/src/components/mark-paths.ts';

const SIZE = 1024;
const here = dirname(fileURLToPath(import.meta.url));
const tokensPath = join(here, '../../../packages/ui/tokens.json');
const outPath = join(here, '../build/icon.png');

interface Token {
  name: string;
  value: { dark: string };
}

async function darkColours(): Promise<Record<string, string>> {
  const tokens = JSON.parse(await readFile(tokensPath, 'utf8')) as { color: { tokens: Token[] } };
  return Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t.value.dark]));
}

/** The mark on a graphite plate, on macOS's icon grid (824 px plate, 100 px margin). */
function iconSvg(c: Record<string, string>): string {
  const colour = (name: string): string => {
    const value = c[name];
    if (value === undefined) throw new Error(`tokens.json has no colour ${name}`);
    return value;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(SIZE)}" height="${String(SIZE)}" viewBox="0 0 1024 1024">
  <rect x="100" y="100" width="824" height="824" rx="185" fill="${colour('surface')}"/>
  <g transform="translate(256 256) scale(8)">
    <defs><clipPath id="bean"><path d="${BEAN_PATH}"/></clipPath></defs>
    <rect width="64" height="64" rx="16" fill="${colour('heat-fill')}"/>
    <g transform="${BEAN_TURN}">
      <path d="${BEAN_PATH}" fill="${colour('bg')}"/>
      <path d="${CUT_PATH}" clip-path="url(#bean)" fill="none" stroke="${colour('heat-fill')}" stroke-width="4.2" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;
}

async function main(): Promise<void> {
  await app.whenReady();
  const window = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true, zoomFactor: 1 },
  });
  const html = `<html><body style="margin:0;background:transparent">${iconSvg(await darkColours())}</body></html>`;
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  // Capturing before the first paint fails (UnknownVizError): wait for two frames.
  await window.webContents.executeJavaScript(
    'new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))',
  );
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  const png = image.resize({ width: SIZE, height: SIZE }).toPNG();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, png);
  process.stdout.write(`icon written to ${outPath}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`icon failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    app.quit();
  });
