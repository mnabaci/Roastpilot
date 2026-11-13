import { createLogger, silentLogger, type ProfileRepository } from '@roastpilot/core';
import { SKYWALKER_PROFILES } from '@roastpilot/drivers';
import { err, ok, type AutoProfile, type LogEntry } from '@roastpilot/shared';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProfileService } from '../profiles/profile-service';
import { JsonSettingsStore } from './json-settings-store';
import { moveRetiredSoak } from './move-soak';
import { SettingsService } from './settings-service';

const MINE: AutoProfile = { ...SKYWALKER_PROFILES['light-steps'], id: 'custom-a', name: 'Mine' };

let dir: string;
let path: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'roastpilot-soak-'));
  path = join(dir, 'settings.json');
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Main at startup: the settings file as `file` says, your profiles in a store that may fail. */
async function launch(file: object, { saveFails = false } = {}) {
  await writeFile(path, JSON.stringify(file));
  let stored: AutoProfile[] = [MINE];
  const store: ProfileRepository = {
    list: () => Promise.resolve(ok(stored.map((profile) => ({ profile, roasterId: 1 })))),
    save: (profile) => {
      if (saveFails) return Promise.resolve(err({ kind: 'storage-failed', message: 'full' }));
      stored = [...stored.filter((p) => p.id !== profile.id), profile];
      return Promise.resolve(ok(undefined));
    },
    saveAll: () => Promise.resolve(ok(undefined)),
    deleteMany: () => Promise.resolve(ok(0)),
  };
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'app');
  const retired = new JsonSettingsStore(path, { logger: silentLogger });
  const settings = new SettingsService(retired);
  await settings.get();
  const profiles = new ProfileService({
    store,
    newId: () => 'x',
    chosenId: () => 'light-steps',
    onChange: () => undefined,
    activeRoaster: () => ({ id: 1, model: 'skywalker' }),
    roaster: () => ({ name: 'Skywalker', model: 'skywalker' }),
    logger: silentLogger,
  });
  const move = () => moveRetiredSoak({ retired, settings, profiles, profileStore: store, logger });
  const fileNow = async () => JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  const soak = () => stored[0]?.phases[0]?.next;
  const events = () => entries.map((e) => [e.event, e.context]);
  return { move, file: fileNow, soak, events };
}

describe('moveRetiredSoak', () => {
  it('writes a soak other than 1:00 into your profiles, then drops the setting', async () => {
    const app = await launch({ theme: 'light', soakTimeS: 90 });
    await app.move();
    expect(app.soak()).toEqual({ on: 'time', afterS: 90 });
    expect(await app.file()).not.toHaveProperty('soakTimeS');
    expect(await app.file()).toMatchObject({ theme: 'light' });
    expect(app.events()).toEqual([['settings.soak-moved', { soakS: 90, count: 1 }]]);
  });

  it('runs once: the next launch finds nothing to move', async () => {
    const first = await launch({ soakTimeS: 90 });
    await first.move();
    const next = await launch(await first.file());
    await next.move();
    expect(next.events()).toEqual([]);
  });

  it('just drops 1:00, the soak every profile already has', async () => {
    const app = await launch({ soakTimeS: 60 });
    await app.move();
    expect(app.soak()).toEqual({ on: 'time', afterS: 60 });
    expect(await app.file()).not.toHaveProperty('soakTimeS');
    expect(app.events()).toEqual([['settings.soak-moved', { soakS: 60, count: 0 }]]);
  });

  it('does nothing without the old setting', async () => {
    const app = await launch({ theme: 'light' });
    await app.move();
    expect(await app.file()).toEqual({ theme: 'light' });
    expect(app.events()).toEqual([]);
  });

  it('keeps the setting to try again next launch when a profile cannot be saved', async () => {
    const app = await launch({ soakTimeS: 90 }, { saveFails: true });
    await app.move();
    expect(await app.file()).toMatchObject({ soakTimeS: 90 });
    expect(app.events()).toEqual([
      [
        'settings.soak-not-moved',
        { soakS: 90, error: { kind: 'storage-failed', message: 'full' } },
      ],
    ]);
  });
});
