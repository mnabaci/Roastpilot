// The README screenshots in one command: builds the app Storybook (apps/desktop/.storybook, the
// "Screens" stories on the sample world), opens each scene in headless Chrome at 1440 × 900 in
// Dark, and writes docs/images/<scene>.png. Same pixels every run: the sample roasts come from the
// Simulator on a fake clock, and the time zone and locale are fixed here.
//
// Run with: pnpm screenshots   (CHROME_PATH=... if Chrome isn't in the usual place)
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, normalize, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Cdp } from './cdp.ts';
import {
  chromePath,
  contentType,
  devtoolsUrl,
  pngSize,
  scenesIn,
  SHOT,
} from './screenshots-lib.ts';

const root = join(import.meta.dirname, '..');
const built = join(root, 'apps', 'desktop', 'storybook-static');
const images = join(root, 'docs', 'images');
/** Dates and numbers read the same wherever this runs ("Sat 7 Nov · 16:18", "2,000 g"). */
const TIME_ZONE = 'UTC';
const LOCALE = 'en-GB';
const READY_TIMEOUT_MS = 30_000;

function say(line: string) {
  process.stdout.write(`${line}\n`);
}

function buildStorybook() {
  say('Building the app Storybook…');
  const build = spawnSync('pnpm', ['--filter', '@roastpilot/desktop', 'build-storybook'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (build.status !== 0) {
    process.stderr.write(`${build.stdout}\n${build.stderr}\n`);
    throw new Error('The Storybook build failed');
  }
}

/** Serves the built Storybook on a free local port. */
function serve(): Promise<{ server: Server; base: string }> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
    const file = normalize(join(built, path === '/' ? 'index.html' : path));
    if (!file.startsWith(built + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = readFileSync(file);
      response.writeHead(200, { 'Content-Type': contentType(file) }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

/** Starts headless Chrome and resolves with its DevTools address. */
function launchChrome(profileDir: string): Promise<{ chrome: ChildProcess; url: string }> {
  const chrome = spawn(
    chromePath(process.platform, process.env),
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--force-color-profile=srgb',
      '--disable-gpu',
      `--lang=${LOCALE}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  return new Promise((resolve, reject) => {
    let output = '';
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', (chunk: string) => {
      output += chunk;
      const url = devtoolsUrl(output);
      if (url) resolve({ chrome, url });
    });
    chrome.on('error', (error) => {
      reject(new Error(`Couldn't start Chrome (set CHROME_PATH): ${error.message}`));
    });
    chrome.on('exit', (code) => {
      reject(new Error(`Chrome quit before it was ready (${String(code)}):\n${output}`));
    });
  });
}

interface Evaluated<T> {
  result: { value?: T };
  exceptionDetails?: { text: string };
}

/** Runs `expression` in the page, awaiting it if it is a promise. */
async function evaluate<T>(
  cdp: Cdp,
  sessionId: string,
  expression: string,
): Promise<T | undefined> {
  const { result, exceptionDetails } = await cdp.send<Evaluated<T>>(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
}

/** Waits for the scene's play function to finish, failing on a Storybook error. */
async function waitForScene(cdp: Cdp, sessionId: string, storyId: string) {
  const until = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    const state = await evaluate<{ ready: boolean; error: string | null }>(
      cdp,
      sessionId,
      `({
        ready: document.body?.dataset.sceneReady !== undefined,
        error: document.body?.classList.contains('sb-show-errordisplay')
          ? document.getElementById('error-message')?.textContent ?? 'error'
          : null,
      })`,
    );
    if (state?.error) throw new Error(`${storyId}: ${state.error}`);
    if (state?.ready) return;
    if (Date.now() > until) throw new Error(`${storyId}: not ready in ${READY_TIMEOUT_MS} ms`);
    await sleep(100);
  }
}

async function capture(cdp: Cdp, base: string, storyId: string, image: string) {
  const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', {
    url: 'about:blank',
  });
  const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', {
    targetId,
    flatten: true,
  });
  const page = <T>(method: string, params: object = {}) => cdp.send<T>(method, params, sessionId);
  await page('Emulation.setDeviceMetricsOverride', {
    ...SHOT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page('Emulation.setTimezoneOverride', { timezoneId: TIME_ZONE });
  await page('Emulation.setLocaleOverride', { locale: LOCALE });
  await page('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: 'dark' },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ],
  });
  await page('Page.enable');
  await page('Page.navigate', { url: `${base}/iframe.html?id=${storyId}&viewMode=story` });
  await waitForScene(cdp, sessionId, storyId);
  // Fonts in, then two frames so the charts have drawn at their final size.
  await evaluate(
    cdp,
    sessionId,
    `document.fonts.ready.then(() => new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done(true)))))`,
  );
  await sleep(300);
  const { data } = await page<{ data: string }>('Page.captureScreenshot', { format: 'png' });
  const png = Buffer.from(data, 'base64');
  const size = pngSize(png);
  if (size?.width !== SHOT.width || size.height !== SHOT.height) {
    throw new Error(`${image}: ${JSON.stringify(size)}, not ${SHOT.width} × ${SHOT.height}`);
  }
  writeFileSync(join(images, image), png);
  say(`  docs/images/${image}`);
  await cdp.send('Target.closeTarget', { targetId });
}

async function main() {
  buildStorybook();
  const scenes = scenesIn(JSON.parse(readFileSync(join(built, 'index.json'), 'utf8')));
  if (scenes.length === 0) throw new Error('No Screens stories in the Storybook build');
  const { server, base } = await serve();
  const profileDir = mkdtempSync(join(tmpdir(), 'roastpilot-shots-'));
  const { chrome, url } = await launchChrome(profileDir);
  const cdp = await Cdp.connect(url);
  try {
    say(`Capturing ${scenes.length} scenes at ${SHOT.width} × ${SHOT.height}…`);
    for (const { storyId, image } of scenes) await capture(cdp, base, storyId, image);
  } finally {
    cdp.close();
    chrome.kill();
    server.close();
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
