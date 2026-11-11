import type { Logger, NewRoast, RoastRepository, RoastSummaryPatch } from '@roastpilot/core';
import {
  err,
  ok,
  type BeanId,
  type RoastResult,
  type Result,
  type RoastDetail,
  type RoastId,
  type RoastSummary,
  type SavedEvent,
  type SavedSample,
  type StorageError,
} from '@roastpilot/shared';
import { asc, desc, eq } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { attempt } from './attempt';
import {
  eventDetailJson,
  summaryColumns,
  toSavedEvents,
  toSavedProfile,
  toSavedSamples,
} from './roast-rows';
import { moveRoastToBean, saveRoastResult, syncRoastMovement } from './roast-stock';
import { moveStock } from './stock';
import { roastEvents, roasts, roastSamples } from './schema/roasts';
import { transaction } from './transaction';

/** Rows per INSERT, well under SQLite's bound-parameter limit. */
const INSERT_CHUNK = 500;

/** Saved roasts in SQLite (docs/spec/data-model.md). Rows are checked on the way out. */
export class SqliteRoastRepository implements RoastRepository {
  readonly #db: SqliteRemoteDatabase;
  readonly #logger: Logger;

  constructor(db: SqliteRemoteDatabase, logger: Logger) {
    this.#db = db;
    this.#logger = logger;
  }

  /** The roast row, the batch off the bean's green stock and its stock log row, all or nothing. */
  create(roast: NewRoast): Promise<Result<RoastId, StorageError>> {
    const values = {
      startedAt: roast.startedAt,
      mode: roast.mode,
      profile: roast.profile && JSON.stringify(roast.profile),
      roasterId: roast.roasterId,
      beanId: roast.beanId,
      batchG: roast.batchG,
      ghostRoastId: roast.ghostRoastId,
      imported: roast.imported ?? false,
    };
    return transaction(this.#db, async (tx) => {
      const row = await tx.insert(roasts).values(values).returning({ id: roasts.id }).get();
      if (!values.imported && roast.beanId !== null && roast.batchG !== null) {
        const moved = await moveStock(tx, roast.beanId, { greenG: -roast.batchG });
        if (!moved.ok) return moved;
        await syncRoastMovement(tx, row.id);
      }
      return ok(row.id);
    });
  }

  /** Every sample or none: a roast never keeps half a batch of them. */
  addSamples(id: RoastId, samples: readonly SavedSample[]): Promise<Result<void, StorageError>> {
    return transaction(this.#db, async (tx) => {
      for (let i = 0; i < samples.length; i += INSERT_CHUNK) {
        const rows = samples.slice(i, i + INSERT_CHUNK).map((sample) => ({
          roastId: id,
          tS: sample.tS,
          values: JSON.stringify(sample.values),
        }));
        await tx.insert(roastSamples).values(rows).run();
      }
      return ok(undefined);
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
          detail: eventDetailJson(event),
        })
        .run();
    });
  }

  update(id: RoastId, patch: RoastSummaryPatch): Promise<Result<void, StorageError>> {
    const { profile, ...rest } = patch;
    // The profile is saved as its JSON copy, as at create.
    const row =
      profile === undefined ? rest : { ...rest, profile: profile && JSON.stringify(profile) };
    return attempt(async () => {
      await this.#db.update(roasts).set(row).where(eq(roasts.id, id)).run();
    });
  }

  /** Saves what you say about the roast; stock and its log row move by what changed. */
  saveResult(result: RoastResult): Promise<Result<void, StorageError>> {
    return transaction(this.#db, (tx) => saveRoastResult(tx, result));
  }

  /** Links the roast to another bean, moving its weights and its stock log row, all or nothing. */
  setBean(id: RoastId, beanId: BeanId | null): Promise<Result<void, StorageError>> {
    return transaction(this.#db, (tx) => moveRoastToBean(tx, id, beanId));
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
    const read = await attempt(() => this.#readRows(id));
    if (!read.ok) return read;
    if (!read.value) return err({ kind: 'not-found', id });
    const { summary, samples, events } = read.value;
    // A row that doesn't parse is skipped (and logged) rather than failing the whole roast.
    const savedSamples = toSavedSamples(samples);
    const savedEvents = toSavedEvents(events);
    const skipped = samples.length - savedSamples.length + (events.length - savedEvents.length);
    if (skipped > 0) this.#logger.warn('storage.rows-unreadable', { roastId: id, skipped });
    // An unreadable copy only loses the plan line; the roast itself stays.
    const profile = toSavedProfile(summary.profile);
    if (profile === undefined) this.#logger.warn('storage.profile-unreadable', { roastId: id });
    return ok({ ...summary, profile: profile ?? null, samples: savedSamples, events: savedEvents });
  }

  /** The roast's row with its samples and events, unparsed; undefined when there is no such roast. */
  async #readRows(id: RoastId) {
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
  }

  /** Its stock log row stays, with no roast (ON DELETE SET NULL), so the history adds up. */
  async delete(id: RoastId): Promise<Result<void, StorageError>> {
    const deleted = await attempt(() =>
      this.#db.delete(roasts).where(eq(roasts.id, id)).returning({ id: roasts.id }).all(),
    );
    if (!deleted.ok) return deleted;
    return deleted.value.length > 0 ? ok(undefined) : err({ kind: 'not-found', id });
  }
}
