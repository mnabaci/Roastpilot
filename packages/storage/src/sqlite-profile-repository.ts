import type { Clock, Logger, ProfileRepository } from '@roastpilot/core';
import {
  AutoProfileSchema,
  ok,
  type AutoProfile,
  type ProfileId,
  type Result,
  type StorageError,
} from '@roastpilot/shared';
import { asc, eq } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { attempt, parseJson } from './attempt';
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

  async list(): Promise<Result<AutoProfile[], StorageError>> {
    const rows = await attempt(() =>
      this.#db.select().from(profiles).orderBy(asc(profiles.updatedAt), asc(profiles.id)).all(),
    );
    if (!rows.ok) return rows;
    return ok(
      rows.value.flatMap((row) => {
        const parsed = AutoProfileSchema.safeParse(parseJson(row.doc));
        if (parsed.success) return [parsed.data];
        // Kept in the table, so a later version that can read it still finds it.
        this.#logger.warn('storage.profile-unreadable', { id: row.id });
        return [];
      }),
    );
  }

  save(profile: AutoProfile): Promise<Result<void, StorageError>> {
    const updatedAt = new Date(this.#clock.now()).toISOString();
    const doc = JSON.stringify(profile);
    return attempt(async () => {
      await this.#db
        .insert(profiles)
        .values({ id: profile.id, doc, updatedAt })
        .onConflictDoUpdate({ target: profiles.id, set: { doc, updatedAt } })
        .run();
    });
  }

  delete(id: ProfileId): Promise<Result<boolean, StorageError>> {
    return attempt(async () => {
      const deleted = await this.#db
        .delete(profiles)
        .where(eq(profiles.id, id))
        .returning({ id: profiles.id })
        .all();
      return deleted.length > 0;
    });
  }
}
