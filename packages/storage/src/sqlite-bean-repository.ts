import type { BeanRepository } from '@roastpilot/core';
import {
  err,
  ok,
  type AddStock,
  type AdjustStock,
  type Bean,
  type BeanFields,
  type BeanId,
  type ProfileId,
  type Result,
  type StockMovement,
  type StorageError,
} from '@roastpilot/shared';
import { and, asc, eq, isNotNull, not, sql } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { attempt } from './attempt';
import { beanPurchases, beans, beanStockAdjustments } from './schema/beans';
import { roasts } from './schema/roasts';
import { transaction } from './transaction';

/** An adjustment's reason as a stock history kind. */
const ADJUSTED = { count: 'counted', returned: 'returned', taken: 'taken' } as const;

/** Beans and stock in SQLite (docs/spec/data-model.md, Roasters and beans). */
export class SqliteBeanRepository implements BeanRepository {
  readonly #db: SqliteRemoteDatabase;

  constructor(db: SqliteRemoteDatabase) {
    this.#db = db;
  }

  list(): Promise<Result<Bean[], StorageError>> {
    return attempt(async () => {
      const rows = await this.#db
        .select()
        .from(beans)
        .orderBy(asc(beans.name), asc(beans.id))
        .all();
      const losses = await this.#db
        .select({
          beanId: roasts.beanId,
          avg: sql<number>`avg((${roasts.batchG} - ${roasts.roastedG}) * 100.0 / ${roasts.batchG})`,
        })
        .from(roasts)
        .where(
          and(
            isNotNull(roasts.beanId),
            // A roasted weight above the green one is a typo, not a weight loss.
            sql`${roasts.roastedG} <= ${roasts.batchG}`,
          ),
        )
        .groupBy(roasts.beanId)
        .all();
      return rows.map((row) => ({
        ...row,
        avgLossPct: losses.find((l) => l.beanId === row.id)?.avg ?? null,
      }));
    });
  }

  add(fields: BeanFields): Promise<Result<BeanId, StorageError>> {
    return attempt(async () => {
      const row = await this.#db.insert(beans).values(fields).returning({ id: beans.id }).get();
      return row.id;
    });
  }

  /** Inserted one by one inside the transaction, so the ids come back in order. */
  addAll(
    list: readonly { fields: BeanFields; profileId: ProfileId | null }[],
  ): Promise<Result<BeanId[], StorageError>> {
    return transaction(this.#db, async (tx) => {
      const ids: BeanId[] = [];
      for (const { fields, profileId } of list) {
        const row = await tx
          .insert(beans)
          .values({ ...fields, profileId })
          .returning({ id: beans.id })
          .get();
        ids.push(row.id);
      }
      return ok(ids);
    });
  }

  async #changed(
    id: BeanId,
    change: () => Promise<{ id: number }[]>,
  ): Promise<Result<void, StorageError>> {
    const updated = await attempt(change);
    if (!updated.ok) return updated;
    return updated.value.length > 0 ? ok(undefined) : err({ kind: 'not-found', id });
  }

  update(
    id: BeanId,
    fields: BeanFields,
    profileId: ProfileId | null,
  ): Promise<Result<void, StorageError>> {
    return this.#changed(id, () =>
      this.#db
        .update(beans)
        .set({ ...fields, profileId })
        .where(eq(beans.id, id))
        .returning({ id: beans.id })
        .all(),
    );
  }

  setArchived(id: BeanId, archived: boolean): Promise<Result<void, StorageError>> {
    return this.#changed(id, () =>
      this.#db
        .update(beans)
        .set({ archived })
        .where(eq(beans.id, id))
        .returning({ id: beans.id })
        .all(),
    );
  }

  /** More green stock and its purchase row, all or nothing. */
  addStock({ beanId, grams, purchasedAt }: AddStock): Promise<Result<void, StorageError>> {
    return transaction(this.#db, async (tx) => {
      const added = await tx
        .update(beans)
        .set({ greenG: sql`${beans.greenG} + ${grams}` })
        .where(eq(beans.id, beanId))
        .returning({ id: beans.id })
        .all();
      if (added.length === 0) return err({ kind: 'not-found', id: beanId });
      await tx.insert(beanPurchases).values({ beanId, grams, purchasedAt }).run();
      return ok(undefined);
    });
  }

  /** The new stock and, when it changed, what changed as an adjustment, all or nothing. */
  adjustStock({
    beanId,
    greenG,
    roastedG,
    reason = 'count',
    note = null,
  }: AdjustStock): Promise<Result<void, StorageError>> {
    return transaction(this.#db, async (tx) => {
      const before = await tx
        .select({ greenG: beans.greenG, roastedG: beans.roastedG })
        .from(beans)
        .where(eq(beans.id, beanId))
        .get();
      if (!before) return err({ kind: 'not-found', id: beanId });
      await tx.update(beans).set({ greenG, roastedG }).where(eq(beans.id, beanId)).run();
      const change = { greenG: greenG - before.greenG, roastedG: roastedG - before.roastedG };
      if (change.greenG !== 0 || change.roastedG !== 0) {
        await tx
          .insert(beanStockAdjustments)
          .values({
            beanId,
            adjustedAt: new Date().toISOString(),
            reason,
            note: note === '' ? null : note,
            ...change,
          })
          .run();
      }
      return ok(undefined);
    });
  }

  /**
   * Everything that moved the bean's stock, oldest first: its purchases, the roasts made here
   * (an imported one never touched stock) and its adjustments.
   */
  stockHistory(id: BeanId): Promise<Result<StockMovement[], StorageError>> {
    return attempt(async () => {
      const bought = await this.#db
        .select({ at: beanPurchases.purchasedAt, grams: beanPurchases.grams })
        .from(beanPurchases)
        .where(eq(beanPurchases.beanId, id))
        .all();
      const roasted = await this.#db
        .select({
          id: roasts.id,
          at: roasts.startedAt,
          batchG: roasts.batchG,
          roastedG: roasts.roastedG,
        })
        .from(roasts)
        .where(and(eq(roasts.beanId, id), not(roasts.imported), isNotNull(roasts.batchG)))
        .all();
      const adjusted = await this.#db
        .select()
        .from(beanStockAdjustments)
        .where(eq(beanStockAdjustments.beanId, id))
        .all();
      const movements: StockMovement[] = [
        ...bought.map((p) => ({
          at: p.at,
          kind: 'bought' as const,
          greenG: p.grams,
          roastedG: 0,
          roastId: null,
          note: null,
        })),
        ...roasted.map((r) => ({
          at: r.at,
          kind: 'roasted' as const,
          greenG: -(r.batchG ?? 0),
          roastedG: r.roastedG ?? 0,
          roastId: r.id,
          note: null,
        })),
        ...adjusted.map((a) => ({
          at: a.adjustedAt,
          kind: ADJUSTED[a.reason],
          greenG: a.greenG,
          roastedG: a.roastedG,
          roastId: null,
          note: a.note,
        })),
      ];
      // A purchase's date sorts before that day's roasts: the bag came first. ISO strings sort
      // by time as text.
      return movements.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    });
  }
}
