import { silentLogger } from '@roastpilot/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openStores } from './storage-wiring';
import { systemClock } from './system-clock';

describe('openStores', () => {
  const dirs: string[] = [];
  const tempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'roastpilot-stores-'));
    dirs.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('opens the database and serves every store from it', async () => {
    const stores = openStores(join(tempDir(), 'roastpilot.db'), systemClock, silentLogger);
    expect(await stores.roasts.list()).toMatchObject({ ok: true });
    expect(await stores.profileStore.list()).toMatchObject({ ok: true });
    expect(await stores.roasterStore.list()).toMatchObject({ ok: true });
    expect(await stores.beanStore.list()).toMatchObject({ ok: true });
    stores.close();
  });

  it('without a database every store fails with the reason, and close does nothing', async () => {
    const stores = openStores(
      join(tempDir(), 'missing', 'roastpilot.db'),
      systemClock,
      silentLogger,
    );
    const failed = { ok: false, error: { kind: 'storage-failed' } };
    expect(await stores.roasts.list()).toMatchObject(failed);
    expect(await stores.profileStore.list()).toMatchObject(failed);
    expect(await stores.roasterStore.list()).toMatchObject(failed);
    expect(await stores.beanStore.list()).toMatchObject(failed);
    expect(() => {
      stores.close();
    }).not.toThrow();
  });
});
