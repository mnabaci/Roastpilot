import type { Logger, RoasterRepository } from '@roastpilot/core';
import {
  AutoTuningSchema,
  ConnectTargetSchema,
  err,
  ok,
  modelFacts,
  RoasterModelSchema,
  Tc4WiringSchema,
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
import { transaction } from './transaction';

type Row = typeof roasters.$inferSelect;

const toColumns = ({ tuning, connection, wiring, active, ...plain }: Omit<Roaster, 'id'>) => ({
  ...plain,
  connection: connection && JSON.stringify(connection),
  wiring: wiring && JSON.stringify(wiring),
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
    const { pid, connection, wiring, isActive, model, ...plain } = row;
    const tuning = AutoTuningSchema.safeParse(parseJson(pid));
    // SQLite doesn't check the enum: a model from a newer app has no driver or limits here.
    const knownModel = RoasterModelSchema.safeParse(model);
    // Wiring decides which output is the heater: one that doesn't read is never guessed.
    const wired =
      knownModel.success && modelFacts(knownModel.data).wiring
        ? Tc4WiringSchema.safeParse(wiring === null ? undefined : parseJson(wiring))
        : undefined;
    if (!tuning.success || !knownModel.success || wired?.success === false) {
      this.#logger.warn('storage.roaster-unreadable', { id: row.id, model });
      return [];
    }
    // NULL is a roaster with no port picked yet (the seeded Skywalker): valid, not unreadable.
    const target =
      connection === null ? null : ConnectTargetSchema.safeParse(parseJson(connection));
    // A lost connection only means picking the port again; the record itself stays.
    if (target?.success === false)
      this.#logger.warn('storage.roaster-connection-unreadable', { id: row.id });
    return [
      {
        ...plain,
        model: knownModel.data,
        tuning: tuning.data,
        wiring: wired?.success ? wired.data : null,
        // Only a model with wiring has the setting (checkRoaster): never a fan held on another.
        minFanHeatingPct: wired ? plain.minFanHeatingPct : 0,
        connection: target?.success ? target.data : null,
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

  addAll(list: readonly Omit<Roaster, 'id'>[]): Promise<Result<Roaster[], StorageError>> {
    return transaction(this.#db, async (tx) => {
      const added: Roaster[] = [];
      for (const roaster of list) {
        const row = await tx
          .insert(roasters)
          .values(toColumns(roaster))
          .returning({ id: roasters.id })
          .get();
        added.push({ ...roaster, id: row.id });
      }
      return ok(added);
    });
  }

  save({ id, ...roaster }: Roaster): Promise<Result<void, StorageError>> {
    return attempt(async () => {
      await this.#db.update(roasters).set(toColumns(roaster)).where(eq(roasters.id, id)).run();
    });
  }

  /** Makes this roaster the only active one, all or nothing. */
  setActive(id: RoasterId): Promise<Result<void, StorageError>> {
    return transaction(this.#db, async (tx) => {
      const on = await tx
        .update(roasters)
        .set({ isActive: true })
        .where(eq(roasters.id, id))
        .returning({ id: roasters.id })
        .all();
      if (on.length === 0) return err({ kind: 'not-found', id });
      await tx.update(roasters).set({ isActive: false }).where(ne(roasters.id, id)).run();
      return ok(undefined);
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
