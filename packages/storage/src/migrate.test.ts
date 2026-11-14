import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { migrate, MIGRATIONS, pendingMigrations, schemaVersion } from './migrate';

const tables = (db: DatabaseSync) =>
  (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[]
  ).map((row) => row.name);
const version = (db: DatabaseSync) =>
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

describe('migrate', () => {
  it('lists every migration drizzle-kit generated, in journal order', () => {
    const journal = JSON.parse(
      readFileSync(join(import.meta.dirname, 'migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: { tag: string }[] };
    expect(MIGRATIONS.map((m) => m.tag)).toEqual(journal.entries.map((e) => e.tag));
  });

  it('builds an empty database, and does nothing the second time', () => {
    const db = new DatabaseSync(':memory:');
    expect(migrate(db)).toEqual({
      ok: true,
      value: {
        applied: [
          '0000_roasts',
          '0001_profiles',
          '0002_roasters',
          '0003_beans',
          '0004_roast_imported',
          '0005_cooler_helps_drum',
          '0006_drum_speed',
          '0007_bean_link',
          '0008_bean_species',
          '0009_drop_purchase_batch_plan',
          '0010_bean_stock_adjustments',
          '0011_stock_movements',
          '0012_tc4_wiring',
        ],
      },
    });
    expect(tables(db)).toEqual(
      expect.arrayContaining([
        'bean_stock_movements',
        'beans',
        'profiles',
        'roast_events',
        'roast_samples',
        'roasters',
        'roasts',
      ]),
    );
    expect(version(db)).toBe(MIGRATIONS.length);
    expect(migrate(db)).toEqual({ ok: true, value: { applied: [] } });
  });

  it('0012 gives existing roasters no wiring and no minimum fan', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 12));
    migrate(db);
    expect(
      db.prepare('SELECT wiring, min_fan_heating_pct AS minFan FROM roasters ORDER BY id').all(),
    ).toEqual([
      { wiring: null, minFan: 0 },
      { wiring: null, minFan: 0 },
    ]);
  });

  it('brings a database from the first version up to date, keeping its roasts', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 1));
    db.exec(`INSERT INTO roasts (mode, started_at) VALUES ('manual', '2026-11-04T10:00:00.000Z')`);
    expect(migrate(db)).toEqual({
      ok: true,
      value: {
        applied: [
          '0001_profiles',
          '0002_roasters',
          '0003_beans',
          '0004_roast_imported',
          '0005_cooler_helps_drum',
          '0006_drum_speed',
          '0007_bean_link',
          '0008_bean_species',
          '0009_drop_purchase_batch_plan',
          '0010_bean_stock_adjustments',
          '0011_stock_movements',
          '0012_tc4_wiring',
        ],
      },
    });
    expect(db.prepare('SELECT mode, profile, roaster_id FROM roasts').all()).toEqual([
      { mode: 'manual', profile: null, roaster_id: 1 },
    ]);
    expect(tables(db)).toContain('profiles');
  });

  it('makes Skywalker and Simulator, Skywalker active, and gives it your own profiles', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 2));
    db.exec(`INSERT INTO profiles VALUES ('custom-1', '{}', '2026-11-04T10:00:00.000Z')`);
    migrate(db);
    expect(db.prepare('SELECT id, name, model, is_active FROM roasters').all()).toEqual([
      { id: 1, name: 'Skywalker', model: 'skywalker', is_active: 1 },
      { id: 2, name: 'Simulator', model: 'simulator', is_active: 0 },
    ]);
    expect(db.prepare('SELECT roaster_id FROM profiles').all()).toEqual([{ roaster_id: 1 }]);
  });

  it('marks roasts saved without a roaster as imported, and only those', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 4));
    db.exec(`INSERT INTO roasts (mode, started_at, roaster_id) VALUES
      ('manual', '2026-11-04T10:00:00.000Z', 1),
      ('manual', '2026-11-04T11:00:00.000Z', NULL)`);
    migrate(db);
    expect(db.prepare('SELECT roaster_id, imported FROM roasts ORDER BY id').all()).toEqual([
      { roaster_id: 1, imported: 0 },
      { roaster_id: null, imported: 1 },
    ]);
  });

  it('the bean cooler helps cool the drum on Skywalkers only', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 5));
    db.exec(`INSERT INTO roasters (name, model, batch_min_g, batch_ideal_g, batch_max_g, max_temp,
      max_time_s, temp_offset, pid, is_active)
      SELECT 'Second', 'skywalker', batch_min_g, batch_ideal_g, batch_max_g, max_temp, max_time_s,
      temp_offset, pid, 0 FROM roasters WHERE id = 1`);
    migrate(db);
    expect(db.prepare('SELECT model, cooler_helps_drum FROM roasters ORDER BY id').all()).toEqual([
      { model: 'skywalker', cooler_helps_drum: 1 },
      { model: 'simulator', cooler_helps_drum: 0 },
      { model: 'skywalker', cooler_helps_drum: 1 },
    ]);
  });

  it('gives every existing roaster the usual drum speed of 60 %', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 6));
    migrate(db);
    expect(db.prepare('SELECT model, drum_speed_pct FROM roasters ORDER BY id').all()).toEqual([
      { model: 'skywalker', drum_speed_pct: 60 },
      { model: 'simulator', drum_speed_pct: 60 },
    ]);
  });

  it('keeps every bean, with no order link yet', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 7));
    db.exec(
      `INSERT INTO beans (name, origin, process) VALUES ('African Moon', 'Uganda', 'natural')`,
    );
    migrate(db);
    expect(db.prepare('SELECT name, link FROM beans').all()).toEqual([
      { name: 'African Moon', link: null },
    ]);
  });

  it('keeps every bean, with no species yet', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 8));
    db.exec(
      `INSERT INTO beans (name, origin, process) VALUES ('African Moon', 'Uganda', 'natural')`,
    );
    migrate(db);
    expect(db.prepare('SELECT name, species FROM beans').all()).toEqual([
      { name: 'African Moon', species: null },
    ]);
  });

  it('keeps every purchase, without its stored batch plan', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 9));
    db.exec(
      `INSERT INTO beans (name, origin, process) VALUES ('African Moon', 'Uganda', 'natural')`,
    );
    db.exec(
      `INSERT INTO bean_purchases (bean_id, purchased_at, grams, batch_plan) VALUES (1, '2026-11-01', 2000, '{"kind":"equal","batchesG":[400,400,400,400,400]}')`,
    );
    migrate(db, MIGRATIONS.slice(0, 10));
    expect(db.prepare('SELECT * FROM bean_purchases').all()).toEqual([
      { id: 1, bean_id: 1, purchased_at: '2026-11-01', grams: 2000 },
    ]);
  });

  it('adds stock adjustments to a database with beans, keeping them and their purchases', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, MIGRATIONS.slice(0, 10));
    db.exec(
      `INSERT INTO beans (name, origin, process, green_g) VALUES ('African Moon', 'Uganda', 'natural', 1500)`,
    );
    db.exec(
      `INSERT INTO bean_purchases (bean_id, purchased_at, grams) VALUES (1, '2026-11-01', 2000)`,
    );
    migrate(db, MIGRATIONS.slice(0, 11));
    expect(db.prepare('SELECT id, green_g FROM beans').all()).toEqual([{ id: 1, green_g: 1500 }]);
    expect(db.prepare('SELECT grams FROM bean_purchases').all()).toEqual([{ grams: 2000 }]);
    expect(db.prepare('SELECT * FROM bean_stock_adjustments').all()).toEqual([]);
  });

  it('applies only the migrations a database is missing, keeping its data', () => {
    const db = new DatabaseSync(':memory:');
    const first = [{ tag: 'a', sql: 'CREATE TABLE a (x INTEGER);' }];
    migrate(db, first);
    db.exec('INSERT INTO a VALUES (1)');
    const result = migrate(db, [...first, { tag: 'b', sql: 'ALTER TABLE a ADD COLUMN y TEXT;' }]);
    expect(result).toEqual({ ok: true, value: { applied: ['b'] } });
    expect(db.prepare('SELECT x, y FROM a').all()).toEqual([{ x: 1, y: null }]);
  });

  it('a failing migration rolls back and says which one', () => {
    const db = new DatabaseSync(':memory:');
    const result = migrate(db, [{ tag: 'bad', sql: 'CREATE TABLE ok (x); NOT SQL;' }]);
    expect(result).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
    expect(!result.ok && result.error.kind === 'storage-failed' && result.error.message).toMatch(
      /^Migration bad:/,
    );
    expect(tables(db)).not.toContain('ok');
    expect(version(db)).toBe(0);
  });

  it('returns the error, not a throw, when the transaction is already gone', () => {
    const db = new DatabaseSync(':memory:');
    // Ending the transaction early stands in for SQLite's own rollback on disk-full or I/O errors.
    const result = migrate(db, [{ tag: 'gone', sql: 'COMMIT; NOT SQL;' }]);
    expect(result).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
    expect(db.isTransaction).toBe(false);
  });

  it('refuses a database from a newer app', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA user_version = 99');
    expect(migrate(db)).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
  });

  describe('pendingMigrations', () => {
    it('lists what migrate would run, without running it', () => {
      const db = new DatabaseSync(':memory:');
      migrate(db, MIGRATIONS.slice(0, 5));
      const pending = pendingMigrations(db);
      expect(pending.ok && pending.value.map((m) => m.tag)).toEqual([
        '0005_cooler_helps_drum',
        '0006_drum_speed',
        '0007_bean_link',
        '0008_bean_species',
        '0009_drop_purchase_batch_plan',
        '0010_bean_stock_adjustments',
        '0011_stock_movements',
        '0012_tc4_wiring',
      ]);
      expect(schemaVersion(db)).toBe(5);
    });

    it('is empty for an up-to-date database and everything for a new one', () => {
      const db = new DatabaseSync(':memory:');
      expect(pendingMigrations(db)).toEqual({ ok: true, value: MIGRATIONS });
      migrate(db);
      expect(pendingMigrations(db)).toEqual({ ok: true, value: [] });
    });

    it('refuses a database from a newer app', () => {
      const db = new DatabaseSync(':memory:');
      db.exec(`PRAGMA user_version = ${String(MIGRATIONS.length + 1)}`);
      expect(pendingMigrations(db)).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
    });
  });
});
