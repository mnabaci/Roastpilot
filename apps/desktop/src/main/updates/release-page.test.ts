import { createLogger } from '@roastpilot/core';
import type { LogEntry, UpdateStatus } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { isReleasePageUrl, openReleasePage, releasePageUrl } from './release-page';

function setup(status: UpdateStatus, installedVersion = '0.1.0') {
  const entries: LogEntry[] = [];
  const openExternal = vi.fn((_url: string) => Promise.resolve());
  const deps = {
    installedVersion,
    status: () => status,
    openExternal,
    logger: createLogger({ write: (e) => entries.push(e) }, 'updates'),
  };
  return { deps, openExternal, entries };
}

describe('release pages', () => {
  it('builds the GitHub release page of a version', () => {
    expect(releasePageUrl('0.2.0')).toBe(
      'https://github.com/mnabaci/Roastpilot/releases/tag/v0.2.0',
    );
    expect(releasePageUrl('0.2.0-dev')).toBeUndefined();
    expect(releasePageUrl('../../evil')).toBeUndefined();
  });

  it.each([
    ['https://github.com/mnabaci/Roastpilot/releases/tag/v0.2.0', true],
    ['http://github.com/mnabaci/Roastpilot/releases/tag/v0.2.0', false],
    ['https://github.com/mnabaci/Roastpilot/releases/tag/v0.2.0/../../x', false],
    ['https://github.com.evil.example/mnabaci/Roastpilot/releases/tag/v0.2.0', false],
    ['https://github.com/someone/Roastpilot/releases/tag/v0.2.0', false],
    ['file:///etc/passwd', false],
  ])('%s is ours: %s', (url, ours) => {
    expect(isReleasePageUrl(url)).toBe(ours);
  });

  it("What's new opens the installed version's notes", async () => {
    const { deps, openExternal } = setup({ state: 'idle', checkedAt: null });
    expect(await openReleasePage('installed', deps)).toEqual({ ok: true, value: undefined });
    expect(openExternal).toHaveBeenCalledWith(
      'https://github.com/mnabaci/Roastpilot/releases/tag/v0.1.0',
    );
  });

  it('Download opens the page of the version that is out', async () => {
    const { deps, openExternal } = setup({ state: 'available', version: '0.2.0' });
    expect(await openReleasePage('latest', deps)).toEqual({ ok: true, value: undefined });
    expect(openExternal).toHaveBeenCalledWith(
      'https://github.com/mnabaci/Roastpilot/releases/tag/v0.2.0',
    );
  });

  it('Download with nothing out opens nothing', async () => {
    const { deps, openExternal, entries } = setup({ state: 'idle', checkedAt: null });
    expect(await openReleasePage('latest', deps)).toEqual({
      ok: false,
      error: { kind: 'no-release' },
    });
    expect(openExternal).not.toHaveBeenCalled();
    expect(entries.map((e) => e.event)).toEqual(['update.release-page-refused']);
  });

  it("a development build's version has no release page", async () => {
    const { deps, openExternal } = setup({ state: 'off' }, '0.0.0-dev');
    expect(await openReleasePage('installed', deps)).toEqual({
      ok: false,
      error: { kind: 'no-release' },
    });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('a browser that will not open is logged and reported', async () => {
    const { deps, openExternal, entries } = setup({ state: 'idle', checkedAt: null });
    openExternal.mockRejectedValueOnce(new Error('no browser'));
    expect(await openReleasePage('installed', deps)).toEqual({
      ok: false,
      error: { kind: 'open-failed' },
    });
    expect(entries.map((e) => e.event)).toEqual(['update.release-page-failed']);
  });
});
