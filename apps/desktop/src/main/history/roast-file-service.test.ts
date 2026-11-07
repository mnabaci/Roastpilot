import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { drizzleOn, openDatabase, SqliteRoastRepository } from '@roastpilot/storage';
import { describe, expect, it, vi } from 'vitest';
import { RoastFileService } from './roast-file-service';

/** A History of its own, on an in-memory database with one bean and the two roasters. */
function history(beanName = 'Ethiopia Guji') {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'history');
  const opened = openDatabase(':memory:', logger);
  if (!opened.ok) throw new Error(opened.error.kind);
  opened.value.exec(
    `INSERT INTO beans (name, origin, process, green_g) VALUES ('${beanName}', 'Ethiopia', 'Washed', 1000)`,
  );
  const repository = new SqliteRoastRepository(drizzleOn(opened.value), logger);
  const onAdded = vi.fn();
  const service = new RoastFileService({
    repository,
    names: () =>
      Promise.resolve({
        beans: new Map([[1, beanName]]),
        roasters: new Map([
          [1, 'Skywalker'],
          [2, 'Simulator'],
        ]),
      }),
    onAdded,
    now: () => new Date('2026-11-06T12:00:00.000Z'),
    logger,
  });
  const green = () =>
    (opened.value.prepare('SELECT green_g FROM beans').get() as { green_g: number }).green_g;
  return { repository, service, onAdded, entries, green };
}

async function roastIn(home: ReturnType<typeof history>, startedAt: string) {
  const made = await home.repository.create({
    startedAt,
    mode: 'manual',
    profile: null,
    roasterId: 1,
    beanId: 1,
    batchG: 375,
    ghostRoastId: null,
  });
  if (!made.ok) throw new Error('create failed');
  await home.repository.addSamples(made.value, [{ tS: 0, values: { bt: 180 } }]);
  await home.repository.addEvent(made.value, { kind: 'charge', tS: 0, bt: 180 });
  await home.repository.saveResult({
    id: made.value,
    batchG: 375,
    roastedG: 320,
    rating: 4,
    isFavourite: true,
    notes: 'Bright',
  });
  return made.value;
}

describe('RoastFileService', () => {
  it('names the newest roast it added, for History to open', async () => {
    const home = history();
    await roastIn(home, '2026-11-04T17:37:00.000Z');
    await roastIn(home, '2026-11-04T17:00:00.000Z');
    const text = await home.service.exportFile();
    if (!text.ok) throw new Error('export failed');
    const away = history();
    const imported = await away.service.importFile(text.value);
    const listed = await away.repository.list();
    const newest = listed.ok
      ? listed.value.find((r) => r.startedAt.startsWith('2026-11-04T17:37'))
      : undefined;
    expect(imported.ok && imported.value.newestId).toBe(newest?.id);
  });

  it('moves roasts to another History whole, linked by exact name, without touching stock', async () => {
    const home = history();
    await roastIn(home, '2026-11-04T10:00:00.000Z');
    const text = await home.service.exportFile();
    if (!text.ok) throw new Error('export failed');

    const away = history();
    const imported = await away.service.importFile(text.value);
    const listed = await away.repository.list();
    const [roast] = listed.ok ? listed.value : [];
    expect(imported).toEqual({ ok: true, value: { added: 1, skipped: 0, newestId: roast?.id } });
    expect(roast).toMatchObject({
      beanId: 1,
      roasterId: 1,
      roastedG: 320,
      rating: 4,
      isFavourite: true,
      notes: 'Bright',
      imported: true,
    });
    const detail = roast && (await away.repository.get(roast.id));
    expect(detail?.ok && detail.value.samples).toEqual([{ tS: 0, values: { bt: 180 } }]);
    expect(away.green()).toBe(1000);
    expect(away.onAdded).toHaveBeenCalledOnce();
  });

  it('leaves the bean empty when no bean has exactly that name', async () => {
    const home = history();
    await roastIn(home, '2026-11-04T10:00:00.000Z');
    const text = await home.service.exportFile();
    const away = history('Colombia');
    if (text.ok) await away.service.importFile(text.value);
    const listed = await away.repository.list();
    expect(listed.ok && listed.value[0]?.beanId).toBeNull();
  });

  it('skips roasts already in History and counts them', async () => {
    const home = history();
    await roastIn(home, '2026-11-04T10:00:00.000Z');
    await roastIn(home, '2026-11-04T11:00:00.000Z');
    const text = await home.service.exportFile();
    if (!text.ok) throw new Error('export failed');
    expect(await home.service.importFile(text.value)).toEqual({
      ok: true,
      value: { added: 0, skipped: 2, newestId: null },
    });
  });

  it('exports only the roasts named', async () => {
    const home = history();
    const first = await roastIn(home, '2026-11-04T10:00:00.000Z');
    await roastIn(home, '2026-11-04T11:00:00.000Z');
    const text = await home.service.exportFile([first]);
    const file = text.ok ? (JSON.parse(text.value) as { roasts: { startedAt: string }[] }) : null;
    expect(file?.roasts.map((r) => r.startedAt)).toEqual(['2026-11-04T10:00:00.000Z']);
  });

  it('refuses a file that is not one, and logs why', async () => {
    const away = history();
    expect(await away.service.importFile('{"name":"package"}')).toEqual({
      ok: false,
      error: { kind: 'not-roastpilot' },
    });
    expect(away.entries.some((e) => e.event === 'history.import-refused')).toBe(true);
  });
});
