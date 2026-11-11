import { createLogger, ManualClock } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { openDatabase } from './open-database';
import { drizzleOn } from './proxy-db';
import { SqliteBeanRepository } from './sqlite-bean-repository';
import { SqliteProfileRepository } from './sqlite-profile-repository';
import { SqliteRoastRepository } from './sqlite-roast-repository';
import { SqliteRoasterRepository } from './sqlite-roaster-repository';

// Shared by the storage write tests: an in-memory database with every repository on it.

/** Two beans with 1000 g green each, and a way to make a later statement fail. */
export function setup() {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (entry) => entries.push(entry) }, 'storage');
  const opened = openDatabase(':memory:', logger);
  if (!opened.ok) throw new Error(opened.error.kind);
  const sqlite = opened.value;
  sqlite.exec(`INSERT INTO beans (name, origin, process, green_g) VALUES
    ('Ethiopia', 'Ethiopia', 'Washed', 1000), ('Colombia', 'Colombia', 'Natural', 1000)`);
  const db = drizzleOn(sqlite);
  /** Everything a stock write can touch, to compare before and after. */
  const snapshot = () => ({
    beans: sqlite.prepare('SELECT id, green_g, roasted_g FROM beans ORDER BY id').all(),
    roasts: sqlite.prepare('SELECT * FROM roasts ORDER BY id').all(),
    samples: sqlite.prepare('SELECT count(*) AS n FROM roast_samples').get(),
    movements: sqlite.prepare('SELECT * FROM bean_stock_movements ORDER BY id').all(),
    roasters: sqlite.prepare('SELECT id, name, is_active FROM roasters ORDER BY id').all(),
    profiles: sqlite.prepare('SELECT id FROM profiles ORDER BY id').all(),
  });
  /** From now on, `event` on `table` fails (when `when` holds), as a broken statement would. */
  const failOn = (event: string, table: string, when = '1') => {
    sqlite.exec(`CREATE TRIGGER fail_${table} BEFORE ${event} ON ${table} WHEN ${when}
      BEGIN SELECT RAISE(ABORT, 'disk said no'); END`);
  };
  return {
    sqlite,
    entries,
    snapshot,
    failOn,
    roasts: new SqliteRoastRepository(db, logger),
    beans: new SqliteBeanRepository(db, logger),
    roasters: new SqliteRoasterRepository(db, logger),
    profiles: new SqliteProfileRepository(db, new ManualClock(0), logger),
  };
}

export const failed = { ok: false, error: { kind: 'storage-failed' } };
export const BEAN = {
  name: 'Guji',
  origin: 'Ethiopia',
  process: 'washed',
  species: null,
  variety: null,
  altitudeM: null,
  densityGL: null,
  moisturePct: null,
  screen: null,
  decaf: false,
  supplier: null,
  link: null,
  lowStockG: 500,
  notes: null,
} as const;
export const newRoast = {
  startedAt: '2026-11-04T10:00:00.000Z',
  mode: 'manual',
  profile: null,
  roasterId: null,
  ghostRoastId: null,
  beanId: 1,
  batchG: 400,
} as const;
export const result = (id: number, roastedG: number | null) => ({
  id,
  batchG: 400,
  roastedG,
  rating: null,
  isFavourite: false,
  notes: null,
});

export async function roastOn(env: ReturnType<typeof setup>) {
  const made = await env.roasts.create(newRoast);
  if (!made.ok) throw new Error('create failed');
  await env.roasts.saveResult(result(made.value, 340));
  return made.value;
}
