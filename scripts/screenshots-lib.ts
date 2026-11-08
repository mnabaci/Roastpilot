// Pure helpers for scripts/screenshots.ts, kept apart so they can be tested.
import { extname } from 'node:path';

/** The README's screenshots: one window size, one pixel per CSS pixel. */
export const SHOT = { width: 1440, height: 900 } as const;

/** Stories under this title are scenes; the image is named after the rest of the story id. */
const SCENE_PREFIX = 'screens--';

/** The scenes in a built Storybook's `index.json`, as story id and image name. */
export function scenesIn(index: unknown): { storyId: string; image: string }[] {
  const entries = (index as { entries?: Record<string, { type?: string }> }).entries ?? {};
  return Object.entries(entries)
    .filter(([id, entry]) => entry.type === 'story' && id.startsWith(SCENE_PREFIX))
    .map(([id]) => ({ storyId: id, image: `${id.slice(SCENE_PREFIX.length)}.png` }));
}

/** Width and height from a PNG's header; undefined when it isn't a PNG. */
export function pngSize(png: Uint8Array): { width: number; height: number } | undefined {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.length < 24 || signature.some((byte, i) => png[i] !== byte)) return undefined;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** The browser's DevTools address, from what Chrome prints when it starts. */
export function devtoolsUrl(output: string): string | undefined {
  return /DevTools listening on (ws:\/\/\S+)/.exec(output)?.[1];
}

/** Where Chrome usually is; CHROME_PATH wins. */
export function chromePath(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string {
  if (env.CHROME_PATH) return env.CHROME_PATH;
  if (platform === 'win32') {
    const programFiles = env.PROGRAMFILES ?? 'C:\\Program Files';
    return `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`;
  }
  if (platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return 'google-chrome';
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** The Content-Type for a file the Storybook build serves. */
export function contentType(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}
