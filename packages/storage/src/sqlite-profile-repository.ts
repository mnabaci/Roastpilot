import type { Clock, Logger, ProfileRepository } from '@roastpilot/core';
import {
  AutoProfileSchema,
  ok,
  type AutoProfile,
  type ProfileId,
  type RoasterId,
  type Result,
  type StorageError,
} from '@roastpilot/shared';
import { asc, eq } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { attempt, parseJson } from './attempt';
import { transaction } from './transaction';
import { profiles } from './schema/profiles';

/** Your own profiles in SQLite, one JSON document each (docs/adr/0011-built-in-profile-as-data.md). */
export class SqliteProfileRepository implements ProfileRepository {
  readonly #db: SqliteRemoteDatabase;
  readonly #clock: Clock;
  readonly #logger: Logger;

  constructor(db: SqliteRemoteDatabase, clock: Clock, logger: Logger) {
    this.#db = db;
    this.#clock = clock;
    this.#logger = logger;
  }

  async list(): Promise<Result<{ profile: AutoProfile; roasterId: RoasterId }[], StorageError>> {
    const rows = await attempt(() =>
      this.#db.select().from(profiles).orderBy(asc(profiles.updatedAt), asc(profiles.id)).all(),
    );
    if (!rows.ok) return rows;
    return ok(
      rows.value.flatMap((row) => {
        const parsed = AutoProfileSchema.safeParse(parseJson(row.doc));
        // Every row has a roaster since the roasters migration; 1 only guards an odd row.
        if (parsed.success) return [{ profile: parsed.data, roasterId: row.roasterId ?? 1 }];
        // Kept in the table, so a later version that can read it still finds it.
        this.#logger.warn('storage.profile-unreadable', { id: row.id });
        return [];
      }),
    );
  }

  save(profile: AutoProfile, roasterId: RoasterId): Promise<Result<void, StorageError>> {
    return attempt(() => this.#upsert(this.#db, profile, roasterId));
  }

  saveAll(list: readonly AutoProfile[], roasterId: RoasterId): Promise<Result<void, StorageError>> {
    return transaction(this.#db, async (tx) => {
      for (const profile of list) await this.#upsert(tx, profile, roasterId);
      return ok(undefined);
    });
  }

  async #upsert(
    db: SqliteRemoteDatabase,
    profile: AutoProfile,
    roasterId: RoasterId,
  ): Promise<void> {
    const updatedAt = new Date(this.#clock.now()).toISOString();
    const doc = JSON.stringify(profile);
    await db
      .insert(profiles)
      .values({ id: profile.id, doc, updatedAt, roasterId })
      .onConflictDoUpdate({ target: profiles.id, set: { doc, updatedAt, roasterId } })
      .run();
  }

  deleteMany(ids: readonly ProfileId[]): Promise<Result<number, StorageError>> {
    return transaction(this.#db, async (tx) => {
      let removed = 0;
      // One statement per id, so a failure part way rolls back the ones before it.
      for (const id of ids) {
        const deleted = await tx
          .delete(profiles)
          .where(eq(profiles.id, id))
          .returning({ id: profiles.id })
          .all();
        removed += deleted.length;
      }
      return ok(removed);
    });
  }
}
