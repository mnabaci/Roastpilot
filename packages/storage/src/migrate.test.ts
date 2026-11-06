import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { migrate, MIGRATIONS } from './migrate';

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
        ],
      },
    });
    expect(tables(db)).toEqual(
      expect.arrayContaining([
        'bean_purchases',
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

  it('refuses a database from a newer app', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA user_version = 99');
    expect(migrate(db)).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
  });
});
