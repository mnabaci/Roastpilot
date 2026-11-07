import { describe, expect, it } from 'vitest';
import { isAppNavigation } from './window-navigation';

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
