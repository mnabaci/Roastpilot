import { createLogger } from '@roastpilot/core';
import type { LogEntry, Roaster } from '@roastpilot/shared';
import { openDatabase } from './open-database';
import { drizzleOn } from './proxy-db';
import { SqliteRoastRepository } from './sqlite-roast-repository';
import { SqliteRoasterRepository } from './sqlite-roaster-repository';

/** Repositories on a fresh in-memory database, with every log entry kept. */
export function setup() {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'storage');
  const opened = openDatabase(':memory:', logger);
  if (!opened.ok) throw new Error(opened.error.kind);
  const db = drizzleOn(opened.value);
  return {
    sqlite: opened.value,
    entries,
    repository: new SqliteRoasterRepository(db, logger),
    roasts: new SqliteRoastRepository(db, logger),
  };
}

/** What `list` reads; a failed read fails the test. */
export async function listed(repository: SqliteRoasterRepository): Promise<Roaster[]> {
  const read = await repository.list();
  if (!read.ok) throw new Error('list failed');
  return read.value;
}
