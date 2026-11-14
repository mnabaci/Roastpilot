import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { migrate, MIGRATIONS } from './migrate';

const names = (db: DatabaseSync, type: 'table' | 'index') =>
  (
    db.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').all(type) as {
      name: string;
    }[]
  ).map((row) => row.name);

const INDEXES = [
  'bean_stock_movements_bean',
  'bean_stock_movements_roast',
  'profiles_roaster',
  'roasts_bean',
  'roasts_ghost_roast',
  'roasts_roaster',
];

/** A database at schema 0010 with two beans, their purchases, adjustments and roasts. */
function at0010() {
  const db = new DatabaseSync(':memory:');
  migrate(db, MIGRATIONS.slice(0, 11));
  db.exec(`
    INSERT INTO beans (name, origin, process, green_g, roasted_g) VALUES
      ('African Moon', 'Uganda', 'natural', 1150, 340), ('Guji', 'Ethiopia', 'washed', 500, 0);
    INSERT INTO bean_purchases (bean_id, purchased_at, grams) VALUES
      (1, '2026-11-01', 2000), (2, '2026-11-03', 500);
    INSERT INTO roasts (mode, started_at, roaster_id, bean_id, batch_g, roasted_g, imported) VALUES
      ('manual', '2026-11-04T10:00:00.000Z', 1, 1, 400, 340, 0),
      ('manual', '2026-11-05T10:00:00.000Z', 1, 1, 400, NULL, 0),
      ('manual', '2026-10-01T10:00:00.000Z', NULL, 1, 300, 250, 1),
      ('manual', '2026-11-06T10:00:00.000Z', 1, NULL, 400, 340, 0),
      ('manual', '2026-11-07T10:00:00.000Z', 1, 2, NULL, NULL, 0);
    INSERT INTO bean_stock_adjustments (bean_id, adjusted_at, green_g, roasted_g, reason, note)
    VALUES
      (1, '2026-11-06', -50, 0, 'count', NULL),
      (1, '2026-11-07T09:00:00.000Z', 200, 0, 'returned', NULL),
      (1, '2026-11-08T09:00:00.000Z', -200, 0, 'taken', 'Gave 200 g to Sam');
  `);
  return db;
}

describe('migration 0011: one stock log', () => {
  it('builds an empty database with the log and every new index', () => {
    const db = new DatabaseSync(':memory:');
    expect(migrate(db).ok).toBe(true);
    expect(names(db, 'table')).toContain('bean_stock_movements');
    expect(names(db, 'table')).not.toContain('bean_purchases');
    expect(names(db, 'table')).not.toContain('bean_stock_adjustments');
    expect(names(db, 'index')).toEqual(expect.arrayContaining(INDEXES));
  });

  it('copies purchases, roasts made here and adjustments exactly, then drops the old tables', () => {
    const db = at0010();
    expect(migrate(db, MIGRATIONS.slice(0, 12))).toEqual({
      ok: true,
      value: { applied: ['0011_stock_movements'] },
    });
    expect(
      db
        .prepare(
          'SELECT bean_id, at, kind, green_g, roasted_g, roast_id, note FROM bean_stock_movements ORDER BY id',
        )
        .all(),
    ).toEqual([
      row(1, '2026-11-01', 'bought', 2000, 0),
      row(2, '2026-11-03', 'bought', 500, 0),
      row(1, '2026-11-04T10:00:00.000Z', 'roasted', -400, 340, 1),
      row(1, '2026-11-05T10:00:00.000Z', 'roasted', -400, 0, 2),
      row(1, '2026-11-06', 'counted', -50, 0),
      row(1, '2026-11-07T09:00:00.000Z', 'returned', 200, 0),
      row(1, '2026-11-08T09:00:00.000Z', 'taken', -200, 0, null, 'Gave 200 g to Sam'),
    ]);
    expect(names(db, 'table')).not.toContain('bean_purchases');
    expect(names(db, 'table')).not.toContain('bean_stock_adjustments');
    expect(names(db, 'index')).toEqual(expect.arrayContaining(INDEXES));
    expect(db.prepare('SELECT id, green_g, roasted_g FROM beans ORDER BY id').all()).toEqual([
      { id: 1, green_g: 1150, roasted_g: 340 },
      { id: 2, green_g: 500, roasted_g: 0 },
    ]);
    expect(db.prepare('SELECT count(*) AS n FROM roasts').get()).toEqual({ n: 5 });
  });

  it('a roast deleted after the migration leaves its row, with no roast', () => {
    const db = at0010();
    migrate(db);
    db.exec('PRAGMA foreign_keys = ON; DELETE FROM roasts WHERE id = 1');
    expect(
      db.prepare("SELECT roast_id, green_g FROM bean_stock_movements WHERE kind = 'roasted'").all(),
    ).toEqual([
      { roast_id: null, green_g: -400 },
      { roast_id: 2, green_g: -400 },
    ]);
  });
});

function row(
  beanId: number,
  at: string,
  kind: string,
  greenG: number,
  roastedG: number,
  roastId: number | null = null,
  note: string | null = null,
) {
  return {
    bean_id: beanId,
    at,
    kind,
    green_g: greenG,
    roasted_g: roastedG,
    roast_id: roastId,
    note,
  };
}
