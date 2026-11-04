import { createLogger } from '@roastpilot/core';
import { DEFAULT_SETTINGS, type LogEntry } from '@roastpilot/shared';
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
  it('gives the defaults when there is no file yet, without logging', async () => {
    expect(await store().load()).toEqual(DEFAULT_SETTINGS);
    expect(entries).toEqual([]);
  });

  it('saves and loads settings', async () => {
    const settings = {
      connection: { kind: 'serial' as const, path: '/dev/cu.usbserial-0001' },
      controls: 'full' as const,
      chartSmoothingS: 10 as const,
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
      connection: { kind: 'simulator' },
      controls: 'guided',
      chartSmoothingS: 5,
    });
  });

  it('returns a typed error and logs when the folder is gone', async () => {
    await rm(dir, { recursive: true, force: true });
    const saved = await store().save(DEFAULT_SETTINGS);
    expect(saved).toMatchObject({ ok: false, error: { kind: 'write-failed' } });
    expect(entries.map((e) => e.event)).toEqual(['settings.write-failed']);
  });
});
