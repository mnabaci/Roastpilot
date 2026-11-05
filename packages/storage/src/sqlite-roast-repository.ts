import type { Logger, NewRoast, RoastRepository, RoastSummaryPatch } from '@roastpilot/core';
import {
  err,
  AutoProfileSchema,
  ok,
  SavedEventSchema,
  SavedSampleSchema,
  type RoastResult,
  type Result,
  type RoastDetail,
  type RoastId,
  type RoastSummary,
  type SavedEvent,
  type SavedSample,
  type StorageError,
} from '@roastpilot/shared';
import { asc, desc, eq, sql } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { z } from 'zod';
import { attempt, parseJson } from './attempt';
import { beans } from './schema/beans';
import { roastEvents, roasts, roastSamples } from './schema/roasts';

/** Rows per INSERT, well under SQLite's bound-parameter limit. */
const INSERT_CHUNK = 500;

const EventDetailSchema = z.object({
  bt: z.number().nullable().catch(null),
  note: z.string().optional().catch(undefined),
});

const summaryColumns = {
  id: roasts.id,
  startedAt: roasts.startedAt,
  endedAt: roasts.endedAt,
  fcTimeS: roasts.fcTimeS,
  dropTimeS: roasts.dropTimeS,
  dropTemp: roasts.dropTemp,
  roasterId: roasts.roasterId,
  beanId: roasts.beanId,
  ghostRoastId: roasts.ghostRoastId,
  batchG: roasts.batchG,
  roastedG: roasts.roastedG,
  rating: roasts.rating,
  isFavourite: roasts.isFavourite,
  notes: roasts.notes,
  profileId: sql<string | null>`json_extract(${roasts.profile}, '$.id')`,
  profileName: sql<string | null>`json_extract(${roasts.profile}, '$.name')`,
};

/** Saved roasts in SQLite (docs/spec/data-model.md). Rows are checked on the way out. */
export class SqliteRoastRepository implements RoastRepository {
  readonly #db: SqliteRemoteDatabase;
  readonly #logger: Logger;

  constructor(db: SqliteRemoteDatabase, logger: Logger) {
    this.#db = db;
    this.#logger = logger;
  }

  create(roast: NewRoast): Promise<Result<RoastId, StorageError>> {
    return attempt(async () => {
      const values = {
        startedAt: roast.startedAt,
        mode: roast.mode,
        profile: roast.profile && JSON.stringify(roast.profile),
        roasterId: roast.roasterId,
        beanId: roast.beanId,
        batchG: roast.batchG,
        ghostRoastId: roast.ghostRoastId,
      };
      const row = await this.#db.insert(roasts).values(values).returning({ id: roasts.id }).get();
      if (roast.beanId !== null && roast.batchG !== null) {
        await this.#moveStock(roast.beanId, { greenG: -roast.batchG });
      }
      return row.id;
    });
  }

  addSamples(id: RoastId, samples: readonly SavedSample[]): Promise<Result<void, StorageError>> {
    return attempt(async () => {
      for (let i = 0; i < samples.length; i += INSERT_CHUNK) {
        const rows = samples.slice(i, i + INSERT_CHUNK).map((sample) => ({
          roastId: id,
          tS: sample.tS,
          values: JSON.stringify(sample.values),
        }));
        await this.#db.insert(roastSamples).values(rows).run();
      }
    });
  }

  addEvent(id: RoastId, event: SavedEvent): Promise<Result<void, StorageError>> {
    return attempt(async () => {
      await this.#db
        .insert(roastEvents)
        .values({
          roastId: id,
          tS: event.tS,
          type: event.kind,
          detail: JSON.stringify({ bt: event.bt, note: event.detail }),
        })
        .run();
    });
  }

  update(id: RoastId, patch: RoastSummaryPatch): Promise<Result<void, StorageError>> {
    return attempt(async () => {
      await this.#db.update(roasts).set(patch).where(eq(roasts.id, id)).run();
    });
  }

  /** Moves stock by a difference; it stops at 0. */
  async #moveStock(beanId: number, { greenG = 0, roastedG = 0 }): Promise<void> {
    await this.#db
      .update(beans)
      .set({
        greenG: sql`max(0, ${beans.greenG} + ${greenG})`,
        roastedG: sql`max(0, ${beans.roastedG} + ${roastedG})`,
      })
      .where(eq(beans.id, beanId))
      .run();
  }

  /** Saves what you say about the roast; stock moves only by what changed. */
  async saveResult({ id, ...result }: RoastResult): Promise<Result<void, StorageError>> {
    const before = await attempt(() =>
      this.#db
        .select({ beanId: roasts.beanId, batchG: roasts.batchG, roastedG: roasts.roastedG })
        .from(roasts)
        .where(eq(roasts.id, id))
        .get(),
    );
    if (!before.ok) return before;
    const row = before.value;
    if (!row) return err({ kind: 'not-found', id });
    return attempt(async () => {
      await this.#db.update(roasts).set(result).where(eq(roasts.id, id)).run();
      if (row.beanId !== null) {
        await this.#moveStock(row.beanId, {
          greenG: (row.batchG ?? 0) - (result.batchG ?? 0),
          roastedG: (result.roastedG ?? 0) - (row.roastedG ?? 0),
        });
      }
    });
  }

  list(): Promise<Result<RoastSummary[], StorageError>> {
    return attempt(() =>
      this.#db
        .select(summaryColumns)
        .from(roasts)
        .orderBy(desc(roasts.startedAt), desc(roasts.id))
        .all(),
    );
  }

  async get(id: RoastId): Promise<Result<RoastDetail, StorageError>> {
    const read = await attempt(async () => {
      const summary = await this.#db
        .select({ ...summaryColumns, mode: roasts.mode, profile: roasts.profile })
        .from(roasts)
        .where(eq(roasts.id, id))
        .get();
      if (!summary) return undefined;
      const samples = await this.#db
        .select({ tS: roastSamples.tS, values: roastSamples.values })
        .from(roastSamples)
        .where(eq(roastSamples.roastId, id))
        .orderBy(asc(roastSamples.tS))
        .all();
      const events = await this.#db
        .select({ tS: roastEvents.tS, type: roastEvents.type, detail: roastEvents.detail })
        .from(roastEvents)
        .where(eq(roastEvents.roastId, id))
        .orderBy(asc(roastEvents.tS))
        .all();
      return { summary, samples, events };
    });
    if (!read.ok) return read;
    if (!read.value) return err({ kind: 'not-found', id });
    const { summary, samples, events } = read.value;
    // A row that doesn't parse is skipped (and logged) rather than failing the whole roast.
    const savedSamples = samples.flatMap((row) => {
      const parsed = SavedSampleSchema.safeParse({ tS: row.tS, values: parseJson(row.values) });
      return parsed.success ? [parsed.data] : [];
    });
    const savedEvents = events.flatMap((row) => {
      const detail = EventDetailSchema.safeParse(parseJson(row.detail));
      const parsed = SavedEventSchema.safeParse({
        kind: row.type,
        tS: row.tS,
        bt: detail.success ? detail.data.bt : null,
        ...(detail.success && detail.data.note !== undefined ? { detail: detail.data.note } : {}),
      });
      return parsed.success ? [parsed.data] : [];
    });
    const skipped = samples.length - savedSamples.length + (events.length - savedEvents.length);
    if (skipped > 0) this.#logger.warn('storage.rows-unreadable', { roastId: id, skipped });
    // An unreadable copy only loses the plan line; the roast itself stays.
    const profile = AutoProfileSchema.nullable().safeParse(
      summary.profile === null ? null : parseJson(summary.profile),
    );
    if (!profile.success) this.#logger.warn('storage.profile-unreadable', { roastId: id });
    return ok({
      ...summary,
      profile: profile.success ? profile.data : null,
      samples: savedSamples,
      events: savedEvents,
    });
  }

  async delete(id: RoastId): Promise<Result<void, StorageError>> {
    const deleted = await attempt(() =>
      this.#db.delete(roasts).where(eq(roasts.id, id)).returning({ id: roasts.id }).all(),
    );
    if (!deleted.ok) return deleted;
    return deleted.value.length > 0 ? ok(undefined) : err({ kind: 'not-found', id });
  }
}
