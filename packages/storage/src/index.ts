// @roastpilot/storage: SQLite on node:sqlite with Drizzle (ADR 0010), behind repositories.
export { openDatabase } from './open-database';
export { drizzleOn } from './proxy-db';
export { SqliteRoastRepository } from './sqlite-roast-repository';
