import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileLogSink, logDay, pruneOldLogs } from './file-log-sink';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'roastpilot-logs-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const lines = async (name: string) =>
  (await readFile(join(dir, name), 'utf8'))
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as Record<string, unknown>);

describe('FileLogSink', () => {
  it('appends one JSON line per entry to the day file, after flush', async () => {
    const time = new Date(2026, 10, 2, 21, 30);
    const sink = new FileLogSink({ dir, now: () => time, onError: () => undefined });
    sink.write({ level: 'info', scope: 'session', event: 'session.connected' });
    sink.write({
      level: 'warn',
      scope: 'session',
      event: 'session.read-failed',
      context: { error: { kind: 'no-reply' } },
    });
    await sink.flush();
    expect(await lines('roastpilot-2026-11-02.log')).toEqual([
      { time: time.toISOString(), level: 'info', scope: 'session', event: 'session.connected' },
      {
        time: time.toISOString(),
        level: 'warn',
        scope: 'session',
        event: 'session.read-failed',
        context: { error: { kind: 'no-reply' } },
      },
    ]);
  });

  it('returns from write before anything is on disk: logging never blocks', async () => {
    const sink = new FileLogSink({ dir, onError: () => undefined });
    sink.write({ level: 'info', scope: 'app', event: 'app.started' });
    const contents = await Promise.all(
      (await readdir(dir)).map((n) => readFile(join(dir, n), 'utf8')),
    );
    expect(contents.every((c) => c === '')).toBe(true);
    await sink.flush();
  });

  it('starts a new file when the day changes', async () => {
    let time = new Date(2026, 10, 2, 23, 59);
    const sink = new FileLogSink({ dir, now: () => time, onError: () => undefined });
    sink.write({ level: 'info', scope: 'app', event: 'a' });
    time = new Date(2026, 10, 3, 0, 1);
    sink.write({ level: 'info', scope: 'app', event: 'b' });
    await sink.flush();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await readdir(dir)).sort()).toEqual([
      'roastpilot-2026-11-02.log',
      'roastpilot-2026-11-03.log',
    ]);
  });

  it('keeps appending after a flush, so quit-time flushes lose nothing later', async () => {
    const sink = new FileLogSink({
      dir,
      now: () => new Date(2026, 10, 2),
      onError: () => undefined,
    });
    sink.write({ level: 'info', scope: 'app', event: 'a' });
    await sink.flush();
    sink.write({ level: 'info', scope: 'app', event: 'b' });
    await sink.flush();
    expect((await lines('roastpilot-2026-11-02.log')).map((l) => l.event)).toEqual(['a', 'b']);
  });

  it('reports a failing disk instead of throwing', async () => {
    const errors: unknown[] = [];
    const sink = new FileLogSink({ dir, onError: (e) => errors.push(e) });
    await rm(dir, { recursive: true, force: true });
    sink.write({ level: 'error', scope: 'app', event: 'x' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(errors.length).toBe(1);
  });
});

describe('logDay', () => {
  it('uses the local calendar day', () => {
    expect(logDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('pruneOldLogs', () => {
  it('deletes log files older than the kept days and nothing else', async () => {
    for (const name of [
      'roastpilot-2026-10-20.log',
      'roastpilot-2026-10-26.log',
      'roastpilot-2026-10-27.log',
      'notes.txt',
    ]) {
      await writeFile(join(dir, name), '');
    }
    const deleted = await pruneOldLogs(dir, new Date(2026, 10, 2), 7);
    expect(deleted.sort()).toEqual(['roastpilot-2026-10-20.log', 'roastpilot-2026-10-26.log']);
    expect((await readdir(dir)).sort()).toEqual(['notes.txt', 'roastpilot-2026-10-27.log']);
  });
});
