import { createLogger } from '@roastpilot/core';
import { err, ok } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './open-database';
import { drizzleOn } from './proxy-db';
import { beans } from './schema/beans';
import { transaction } from './transaction';

function setup() {
  const opened = openDatabase(':memory:', createLogger({ write: () => undefined }, 'storage'));
  if (!opened.ok) throw new Error(opened.error.kind);
  const sqlite = opened.value;
  const names = () =>
    (sqlite.prepare('SELECT name FROM beans ORDER BY id').all() as { name: string }[]).map(
      (row) => row.name,
    );
  return { sqlite, db: drizzleOn(sqlite), names };
}

const bean = (name: string) => ({ name, origin: 'x', process: 'washed' as const });

describe('transaction', () => {
  it('commits when the work returns ok', async () => {
    const { db, names } = setup();
    const result = await transaction(db, async (tx) => {
      await tx.insert(beans).values(bean('A')).run();
      await tx.insert(beans).values(bean('B')).run();
      return ok(2);
    });
    expect(result).toEqual({ ok: true, value: 2 });
    expect(names()).toEqual(['A', 'B']);
  });

  it('rolls back when the work returns an error, and returns it', async () => {
    const { db, sqlite, names } = setup();
    const result = await transaction(db, async (tx) => {
      await tx.insert(beans).values(bean('A')).run();
      return err({ kind: 'not-found' as const, id: 1 });
    });
    expect(result).toEqual({ ok: false, error: { kind: 'not-found', id: 1 } });
    expect(names()).toEqual([]);
    expect(sqlite.isTransaction).toBe(false);
  });

  it('rolls back a later statement that fails, as a storage-failed result', async () => {
    const { db, names } = setup();
    const result = await transaction(db, async (tx) => {
      await tx.insert(beans).values(bean('A')).run();
      await tx
        .insert(beans)
        .values({ ...bean('B'), id: 1 })
        .run();
      return ok(undefined);
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
    expect(names()).toEqual([]);
  });

  it('does not roll back twice when SQLite already did', async () => {
    const { db, sqlite, names } = setup();
    sqlite.exec(`CREATE TRIGGER no_b BEFORE INSERT ON beans WHEN NEW.name = 'B'
      BEGIN SELECT RAISE(ROLLBACK, 'no B'); END`);
    const result = await transaction(db, async (tx) => {
      await tx.insert(beans).values(bean('A')).run();
      await tx.insert(beans).values(bean('B')).run();
      return ok(undefined);
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
    expect(names()).toEqual([]);
  });

  it('a failure to begin is a storage-failed result, not a throw', async () => {
    const { db, sqlite } = setup();
    sqlite.close();
    expect(await transaction(db, () => Promise.resolve(ok(undefined)))).toMatchObject({
      ok: false,
      error: { kind: 'storage-failed' },
    });
  });

  it('keeps statements from overlapping calls out of an open transaction', async () => {
    const { db, names } = setup();
    let goOn = (): void => undefined;
    const paused = new Promise<void>((resolve) => {
      goOn = resolve;
    });
    const rolledBack = transaction(db, async (tx) => {
      await tx.insert(beans).values(bean('inside')).run();
      await paused;
      return err({ kind: 'not-found' as const, id: 1 });
    });
    const outside = db.insert(beans).values(bean('outside')).run();
    const next = transaction(db, async (tx) => {
      await tx.insert(beans).values(bean('next')).run();
      return ok(undefined);
    });
    await Promise.resolve();
    expect(names()).toEqual(['inside']);
    goOn();
    await Promise.all([rolledBack, outside, next]);
    expect(names()).toEqual(['outside', 'next']);
  });
});
