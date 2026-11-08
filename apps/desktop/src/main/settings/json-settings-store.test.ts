import { createLogger } from '@roastpilot/core';
import { DEFAULT_SETTINGS, type LogEntry, type Settings } from '@roastpilot/shared';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonSettingsStore } from './json-settings-store';

let dir: string;
let path: string;
let entries: LogEntry[];
const store = () =>
  new JsonSettingsStore(path, {
    logger: createLogger({ write: (e) => entries.push(e) }, 'settings'),
    now: () => new Date('2026-11-02T22:00:00.000Z'),
  });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'roastpilot-settings-'));
  path = join(dir, 'settings.json');
  entries = [];
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('JsonSettingsStore', () => {
  it('saves quick changes one after another, the last one winning, without a failed write', async () => {
    const settings = store();
    const changes = [true, false, true, false].map((chartNowLine) =>
      settings.save({ ...DEFAULT_SETTINGS, chartNowLine }),
    );
    expect(await Promise.all(changes)).toEqual(changes.map(() => ({ ok: true, value: undefined })));
    expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ chartNowLine: false });
    expect(entries).toEqual([]);
  });

  it('gives the defaults when there is no file yet, without logging', async () => {
    expect(await store().load()).toEqual(DEFAULT_SETTINGS);
    expect(entries).toEqual([]);
  });

  it('saves and loads settings', async () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      connection: { kind: 'serial', path: '/dev/cu.usbserial-0001' },
      controls: 'full',
      chartSmoothingS: 10,
    };
    expect(await store().save(settings)).toEqual({ ok: true, value: undefined });
    expect(await store().load()).toEqual(settings);
    expect(await readdir(dir)).toEqual(['settings.json']);
  });

  it('moves a file that is not JSON aside instead of overwriting it, and uses the defaults', async () => {
    await writeFile(path, '{ not json');
    expect(await store().load()).toEqual(DEFAULT_SETTINGS);
    const names = await readdir(dir);
    expect(names).toEqual(['settings.json.broken-2026-11-02T22-00-00-000Z']);
    expect(await readFile(join(dir, names[0] ?? ''), 'utf8')).toBe('{ not json');
    expect(entries.map((e) => e.event)).toEqual(['settings.unreadable-moved-aside']);
  });

  it('treats JSON that is not an object as unreadable', async () => {
    await writeFile(path, '"hello"');
    expect(await store().load()).toEqual(DEFAULT_SETTINGS);
    expect(entries.map((e) => e.event)).toEqual(['settings.unreadable-moved-aside']);
  });

  it('keeps the good fields of a file with one bad value', async () => {
    await writeFile(
      path,
      JSON.stringify({ connection: { kind: 'simulator' }, controls: 'expert' }),
    );
    expect(await store().load()).toEqual({
      ...DEFAULT_SETTINGS,
      connection: { kind: 'simulator' },
    });
  });

  describe('the old Soak time setting', () => {
    it('keeps it in the file through saves until it is forgotten', async () => {
      await writeFile(path, JSON.stringify({ roastMode: 'auto', soakTimeS: 90 }));
      const settings = store();
      expect(await settings.load()).toEqual({ ...DEFAULT_SETTINGS, roastMode: 'auto' });
      expect(settings.retiredSoakS()).toBe(90);
      await settings.save({ ...DEFAULT_SETTINGS, theme: 'light' });
      expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ soakTimeS: 90 });
      settings.forgetRetiredSoak();
      await settings.save(DEFAULT_SETTINGS);
      expect(JSON.parse(await readFile(path, 'utf8'))).not.toHaveProperty('soakTimeS');
      expect(settings.retiredSoakS()).toBeUndefined();
    });

    it('counts a length it never offered as none', async () => {
      await writeFile(path, JSON.stringify({ soakTimeS: 7 }));
      const settings = store();
      await settings.load();
      expect(settings.retiredSoakS()).toBeUndefined();
    });

    it('is none in a file without it', async () => {
      await writeFile(path, JSON.stringify({ theme: 'light' }));
      const settings = store();
      await settings.load();
      expect(settings.retiredSoakS()).toBeUndefined();
    });
  });

  it('returns a typed error and logs when the folder is gone', async () => {
    await rm(dir, { recursive: true, force: true });
    const saved = await store().save(DEFAULT_SETTINGS);
    expect(saved).toMatchObject({ ok: false, error: { kind: 'write-failed' } });
    expect(entries.map((e) => e.event)).toEqual(['settings.write-failed']);
  });
});
