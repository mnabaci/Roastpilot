import type { Logger, RoasterRepository } from '@roastpilot/core';
import {
  AutoTuningSchema,
  ConnectTargetSchema,
  err,
  ok,
  RoasterModelSchema,
  type Result,
  type Roaster,
  type RoasterId,
  type StorageError,
} from '@roastpilot/shared';
import { asc, count, eq, ne } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { attempt, parseJson } from './attempt';
import { profiles } from './schema/profiles';
import { roasters } from './schema/roasters';
import { roasts } from './schema/roasts';

type Row = typeof roasters.$inferSelect;

const toColumns = ({ tuning, connection, active, ...plain }: Omit<Roaster, 'id'>) => ({
  ...plain,
  connection: connection && JSON.stringify(connection),
  pid: JSON.stringify(tuning),
  isActive: active,
});

/** Roaster records in SQLite; JSON columns are checked on the way out. */
export class SqliteRoasterRepository implements RoasterRepository {
  readonly #db: SqliteRemoteDatabase;
  readonly #logger: Logger;

  constructor(db: SqliteRemoteDatabase, logger: Logger) {
    this.#db = db;
    this.#logger = logger;
  }

  #toRoaster(row: Row): Roaster[] {
    const { pid, connection, isActive, model, ...plain } = row;
    const tuning = AutoTuningSchema.safeParse(parseJson(pid));
    // SQLite doesn't check the enum: a model from a newer app has no driver or limits here.
    const knownModel = RoasterModelSchema.safeParse(model);
    if (!tuning.success || !knownModel.success) {
      this.#logger.warn('storage.roaster-unreadable', { id: row.id, model });
      return [];
    }
    const target = ConnectTargetSchema.safeParse(connection && parseJson(connection));
    // A lost connection only means picking the port again; the record itself stays.
    if (!target.success) this.#logger.warn('storage.roaster-connection-unreadable', { id: row.id });
    return [
      {
        ...plain,
        model: knownModel.data,
        tuning: tuning.data,
        connection: target.success ? target.data : null,
        active: isActive,
      },
    ];
  }

  async list(): Promise<Result<Roaster[], StorageError>> {
    const rows = await attempt(() =>
      this.#db.select().from(roasters).orderBy(asc(roasters.id)).all(),
    );
    if (!rows.ok) return rows;
    return ok(rows.value.flatMap((row) => this.#toRoaster(row)));
  }

  add(roaster: Omit<Roaster, 'id'>): Promise<Result<Roaster, StorageError>> {
    return attempt(async () => {
      const row = await this.#db
        .insert(roasters)
        .values(toColumns(roaster))
        .returning({ id: roasters.id })
        .get();
      return { ...roaster, id: row.id };
    });
  }

  save({ id, ...roaster }: Roaster): Promise<Result<void, StorageError>> {
    return attempt(async () => {
      await this.#db.update(roasters).set(toColumns(roaster)).where(eq(roasters.id, id)).run();
    });
  }

  async setActive(id: RoasterId): Promise<Result<void, StorageError>> {
    const known = await attempt(() =>
      this.#db.select({ id: roasters.id }).from(roasters).where(eq(roasters.id, id)).all(),
    );
    if (!known.ok) return known;
    if (known.value.length === 0) return err({ kind: 'not-found', id });
    return attempt(async () => {
      // Turn this one on first: a failure between the two leaves two active, which `list` shows,
      // never none.
      await this.#db.update(roasters).set({ isActive: true }).where(eq(roasters.id, id)).run();
      await this.#db.update(roasters).set({ isActive: false }).where(ne(roasters.id, id)).run();
    });
  }

  usage(id: RoasterId): Promise<Result<{ roasts: number; profiles: number }, StorageError>> {
    return attempt(async () => {
      const [roastRow] = await this.#db
        .select({ n: count() })
        .from(roasts)
        .where(eq(roasts.roasterId, id))
        .all();
      const [profileRow] = await this.#db
        .select({ n: count() })
        .from(profiles)
        .where(eq(profiles.roasterId, id))
        .all();
      return { roasts: roastRow?.n ?? 0, profiles: profileRow?.n ?? 0 };
    });
  }

  async delete(id: RoasterId): Promise<Result<void, StorageError>> {
    const deleted = await attempt(() =>
      this.#db.delete(roasters).where(eq(roasters.id, id)).returning({ id: roasters.id }).all(),
    );
    if (!deleted.ok) return deleted;
    return deleted.value.length > 0 ? ok(undefined) : err({ kind: 'not-found', id });
  }
}
