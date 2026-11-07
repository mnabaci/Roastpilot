import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearUpdates, parseInstallLog, takeLastInstall } from './install-log';

const STAGED =
  '2026-11-07T14:02:01Z staged: /Users/me/Library/Application Support/Roastpilot/updates/0.2.0/Roastpilot.app';

describe('parseInstallLog', () => {
  it('reads the last result and the version that was staged', () => {
    const text = [
      '2026-11-06T10:00:00Z result: failed old',
      STAGED,
      '2026-11-07T14:02:03Z result: failed could not move the new app into place',
      '2026-11-07T14:02:03Z rolled back',
    ].join('\n');
    expect(parseInstallLog(text)).toEqual({
      ok: false,
      version: '0.2.0',
      reason: 'could not move the new app into place',
    });
    expect(parseInstallLog(`${STAGED}\n2026-11-07T14:02:03Z result: ok\n`)).toEqual({
      ok: true,
      version: '0.2.0',
    });
  });

  it('no result line (the helper never finished), or garbage, says nothing', () => {
    expect(parseInstallLog(`${STAGED}\n`)).toBeUndefined();
    expect(parseInstallLog('\u0000\u0001 not a log')).toBeUndefined();
    expect(parseInstallLog('2026-11-07T14:02:03Z result: failed')).toEqual({
      ok: false,
      version: null,
      reason: 'unknown',
    });
  });
});

let dir: string;
let entries: LogEntry[];
const logger = () => createLogger({ write: (e) => entries.push(e) }, 'updates');
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rp-installlog-'));
  entries = [];
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('takeLastInstall', () => {
  it('a failed install is reported once: the log is deleted after reading', async () => {
    await writeFile(
      join(dir, 'install.log'),
      `${STAGED}\n2026-11-07T14:02:03Z result: failed timeout\n`,
    );
    expect(await takeLastInstall(dir, logger())).toMatchObject({ ok: false, reason: 'timeout' });
    expect(existsSync(join(dir, 'install.log'))).toBe(false);
    expect(await takeLastInstall(dir, logger())).toBeUndefined();
    expect(entries.map((e) => e.event)).toEqual(['update.install-log']);
  });

  it('a successful install is logged', async () => {
    await writeFile(join(dir, 'install.log'), `${STAGED}\n2026-11-07T14:02:03Z result: ok\n`);
    expect(await takeLastInstall(dir, logger())).toEqual({ ok: true, version: '0.2.0' });
    expect(entries.map((e) => [e.event, e.context])).toEqual([
      ['update.installed', { version: '0.2.0' }],
    ]);
  });

  it('a missing log is ignored quietly; an unreadable one is logged and ignored', async () => {
    expect(await takeLastInstall(dir, logger())).toBeUndefined();
    expect(entries).toEqual([]);
    await mkdir(join(dir, 'install.log'));
    expect(await takeLastInstall(dir, logger())).toBeUndefined();
    expect(entries.map((e) => e.event)).toEqual(['update.install-log-unreadable']);
  });
});

describe('clearUpdates', () => {
  it('deletes a cut-off download and a staged app, keeps the helper log', async () => {
    await writeFile(join(dir, 'Roastpilot-0.2.0.zip'), 'half');
    await mkdir(join(dir, '0.2.0', 'Roastpilot.app'), { recursive: true });
    await writeFile(join(dir, 'install.log'), 'x');
    await clearUpdates(dir);
    expect(await readdir(dir)).toEqual(['install.log']);
  });

  it('a folder that does not exist yet is fine', async () => {
    await expect(clearUpdates(join(dir, 'none'))).resolves.toBeUndefined();
  });
});
