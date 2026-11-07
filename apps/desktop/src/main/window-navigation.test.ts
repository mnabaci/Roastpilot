import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isAppNavigation, isAppPage } from './window-navigation';

const DEV = 'http://localhost:5173';

describe('isAppNavigation', () => {
  it('lets the dev server reload its own pages', () => {
    expect(isAppNavigation('http://localhost:5173/', DEV)).toBe(true);
    expect(isAppNavigation('http://localhost:5173/#/history', DEV)).toBe(true);
  });

  it('blocks look-alike hosts and ports', () => {
    expect(isAppNavigation('http://localhost:5173.evil.example/', DEV)).toBe(false);
    expect(isAppNavigation('http://localhost:51730/', DEV)).toBe(false);
    expect(isAppNavigation('https://example.com/', DEV)).toBe(false);
  });

  it('blocks everything in a packaged build, and anything that is not a URL', () => {
    expect(isAppNavigation('file:///app/index.html', undefined)).toBe(false);
    expect(isAppNavigation('not a url', DEV)).toBe(false);
  });
});

describe('isAppPage', () => {
  const INDEX = join(tmpdir(), 'Roastpilot app', 'renderer', 'index.html');
  const PACKAGED = { devUrl: undefined, indexFile: INDEX };

  it('in development, is any page on the dev server and nothing else', () => {
    const dev = { devUrl: DEV, indexFile: INDEX };
    expect(isAppPage('http://localhost:5173/#/beans', dev)).toBe(true);
    expect(isAppPage('http://localhost:51730/', dev)).toBe(false);
    expect(isAppPage(pathToFileURL(INDEX).href, dev)).toBe(false);
  });

  it('packaged, is the index file with any route, not another file or site', () => {
    const index = pathToFileURL(INDEX).href;
    expect(isAppPage(index, PACKAGED)).toBe(true);
    expect(isAppPage(`${index}#/history?x=1`, PACKAGED)).toBe(true);
    expect(isAppPage(pathToFileURL(join(tmpdir(), 'evil.html')).href, PACKAGED)).toBe(false);
    expect(isAppPage('https://example.com/', PACKAGED)).toBe(false);
    expect(isAppPage('about:blank', PACKAGED)).toBe(false);
    expect(isAppPage('not a url', PACKAGED)).toBe(false);
  });
});
