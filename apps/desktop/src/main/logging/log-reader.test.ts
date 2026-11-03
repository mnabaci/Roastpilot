import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listLogDays, parseLogText, readLogDay } from './log-reader';

const line = (event: string, level = 'info') =>
  JSON.stringify({ time: '2026-11-03T10:00:00.000Z', level, scope: 'app', event });

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'roastpilot-logs-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('parseLogText', () => {
  it('reads every entry, oldest first', () => {
    expect(parseLogText(`${line('a')}\n${line('b')}\n`).records.map((r) => r.event)).toEqual([
      'a',
      'b',
    ]);
  });

  it('skips and counts lines that are not entries: cut-off JSON, bad shape, blank lines ignored', () => {
    const text = [
      line('a'),
      '{"time":"2026-11-03T10:00',
      JSON.stringify({ level: 'info' }),
      '',
      line('b'),
    ].join('\n');
    expect(parseLogText(text)).toMatchObject({ unreadable: 2, truncated: false });
    expect(parseLogText(text).records).toHaveLength(2);
  });

  it('keeps only the newest entries past the limit, and says so', () => {
    const text = ['1', '2', '3', '4'].map((e) => line(e)).join('\n');
    expect(parseLogText(text, 2)).toEqual({
      records: [expect.objectContaining({ event: '3' }), expect.objectContaining({ event: '4' })],
      unreadable: 0,
      truncated: true,
    });
  });
});

describe('readLogDay', () => {
  it("reads that day's file", async () => {
    await writeFile(join(dir, 'roastpilot-2026-11-03.log'), `${line('x', 'error')}\n`);
    const read = await readLogDay(dir, '2026-11-03');
    expect(read.records).toEqual([expect.objectContaining({ event: 'x', level: 'error' })]);
  });

  it('a day without a file is empty', async () => {
    expect(await readLogDay(dir, '2026-01-01')).toEqual({
      records: [],
      unreadable: 0,
      truncated: false,
    });
  });

  it('refuses anything that is not a day, before touching the disk', async () => {
    await expect(readLogDay(dir, '../../etc/passwd')).rejects.toThrow();
    await expect(readLogDay(dir, 42)).rejects.toThrow();
  });
});

describe('listLogDays', () => {
  it('lists log days newest first and ignores other files', async () => {
    await writeFile(join(dir, 'roastpilot-2026-11-01.log'), '');
    await writeFile(join(dir, 'roastpilot-2026-11-03.log'), '');
    await writeFile(join(dir, 'notes.txt'), '');
    expect(await listLogDays(dir)).toEqual(['2026-11-03', '2026-11-01']);
  });

  it('a missing folder has no days', async () => {
    expect(await listLogDays(join(dir, 'nope'))).toEqual([]);
  });
});
