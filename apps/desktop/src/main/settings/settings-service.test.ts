import type { SettingsStore } from '@roastpilot/core';
import { DEFAULT_SETTINGS, err, ok, type Settings } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { SettingsService } from './settings-service';

function memoryStore(initial: Settings = DEFAULT_SETTINGS, failSave = false) {
  const calls = { load: 0, save: 0 };
  let saved = initial;
  const store: SettingsStore = {
    load: () => {
      calls.load++;
      return Promise.resolve(saved);
    },
    save: (s) => {
      calls.save++;
      if (failSave) return Promise.resolve(err({ kind: 'write-failed', message: 'disk full' }));
      saved = s;
      return Promise.resolve(ok(undefined));
    },
  };
  return { store, calls };
}

describe('SettingsService', () => {
  it('loads once and serves from memory', async () => {
    const { store, calls } = memoryStore();
    const service = new SettingsService(store);
    await service.get();
    await service.get();
    expect(calls.load).toBe(1);
  });

  it('saves, then serves what was saved', async () => {
    const service = new SettingsService(memoryStore().store);
    const next = { connection: { kind: 'simulator' as const }, controls: 'full' as const };
    expect(await service.set(next)).toEqual(ok(next));
    expect(await service.get()).toEqual(next);
  });

  it('keeps the old settings when the save fails', async () => {
    const service = new SettingsService(memoryStore(DEFAULT_SETTINGS, true).store);
    expect(await service.set({ connection: null, controls: 'full' })).toEqual(
      err({ kind: 'write-failed', message: 'disk full' }),
    );
    expect(await service.get()).toEqual(DEFAULT_SETTINGS);
  });
});
