import type { BeanRepository } from '@roastpilot/core';
import {
  BatchPlanSchema,
  err,
  ok,
  type AddStock,
  type AdjustStock,
  type BatchPlan,
  type Bean,
  type BeanFields,
  type BeanId,
  type ProfileId,
  type Result,
  type StorageError,
} from '@roastpilot/shared';
import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { attempt, parseJson } from './attempt';
import { beanPurchases, beans } from './schema/beans';
import { roasts } from './schema/roasts';

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
        .where(and(isNotNull(roasts.batchG), isNotNull(roasts.roastedG), isNotNull(roasts.beanId)))
        .groupBy(roasts.beanId)
        .all();
      const purchases = await this.#db
        .select({ beanId: beanPurchases.beanId, plan: beanPurchases.batchPlan })
        .from(beanPurchases)
        .orderBy(desc(beanPurchases.id))
        .all();
      const planOf = (id: BeanId): BatchPlan | null => {
        const latest = purchases.find((p) => p.beanId === id);
        const parsed = BatchPlanSchema.safeParse(latest?.plan && parseJson(latest.plan));
        return parsed.success ? parsed.data : null;
      };
      return rows.map((row) => ({
        ...row,
        avgLossPct: losses.find((l) => l.beanId === row.id)?.avg ?? null,
        batchPlan: planOf(row.id),
      }));
    });
  }

  add(fields: BeanFields): Promise<Result<BeanId, StorageError>> {
    return attempt(async () => {
      const row = await this.#db.insert(beans).values(fields).returning({ id: beans.id }).get();
      return row.id;
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

  async addStock({
    beanId,
    grams,
    purchasedAt,
    plan,
  }: AddStock): Promise<Result<void, StorageError>> {
    const added = await this.#changed(beanId, () =>
      this.#db
        .update(beans)
        .set({ greenG: sql`${beans.greenG} + ${grams}` })
        .where(eq(beans.id, beanId))
        .returning({ id: beans.id })
        .all(),
    );
    if (!added.ok) return added;
    return attempt(async () => {
      await this.#db
        .insert(beanPurchases)
        .values({ beanId, grams, purchasedAt, batchPlan: plan && JSON.stringify(plan) })
        .run();
    });
  }

  adjustStock({ beanId, greenG, roastedG }: AdjustStock): Promise<Result<void, StorageError>> {
    return this.#changed(beanId, () =>
      this.#db
        .update(beans)
        .set({ greenG, roastedG })
        .where(eq(beans.id, beanId))
        .returning({ id: beans.id })
        .all(),
    );
  }
}
