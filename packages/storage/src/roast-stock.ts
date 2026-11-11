import {
  err,
  ok,
  type BeanId,
  type RoastId,
  type RoastResult,
  type Result,
  type StorageError,
} from '@roastpilot/shared';
import { and, eq } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { stockColumns } from './roast-rows';
import { roasts } from './schema/roasts';
import { beanStockMovements } from './schema/stock-movements';
import { moveStock } from './stock';

// A roast's stock writes (docs/spec/data-model.md, Stock log). Each runs inside the caller's
// transaction, so the roast, the bean's stock and the log row change together or not at all.

const roastRow = (roastId: RoastId) =>
  and(eq(beanStockMovements.roastId, roastId), eq(beanStockMovements.kind, 'roasted'));

/**
 * Makes a roast's `roasted` row in the stock log match the roast: −batch green and +roasted
 * weight on its bean. A roast made elsewhere, with no bean or no weights has none.
 */
export async function syncRoastMovement(tx: SqliteRemoteDatabase, id: RoastId): Promise<void> {
  const roast = await tx
    .select({ ...stockColumns, at: roasts.startedAt })
    .from(roasts)
    .where(eq(roasts.id, id))
    .get();
  const greenG = roast?.batchG ? -roast.batchG : 0;
  const roastedG = roast?.roastedG ?? 0;
  if (!roast || roast.imported || roast.beanId === null || (greenG === 0 && roastedG === 0)) {
    await tx.delete(beanStockMovements).where(roastRow(id)).run();
    return;
  }
  const row = { beanId: roast.beanId, greenG, roastedG };
  const updated = await tx
    .update(beanStockMovements)
    .set(row)
    .where(roastRow(id))
    .returning({ id: beanStockMovements.id })
    .all();
  if (updated.length > 0) return;
  await tx
    .insert(beanStockMovements)
    .values({ ...row, at: roast.at, kind: 'roasted', roastId: id })
    .run();
}

/** Saves what you say about the roast; stock moves only by what changed, and its row follows. */
export async function saveRoastResult(
  tx: SqliteRemoteDatabase,
  { id, ...result }: RoastResult,
): Promise<Result<void, StorageError>> {
  const row = await tx.select(stockColumns).from(roasts).where(eq(roasts.id, id)).get();
  if (!row) return err({ kind: 'not-found', id });
  await tx.update(roasts).set(result).where(eq(roasts.id, id)).run();
  if (row.beanId === null || row.imported) return ok(undefined);
  const moved = await moveStock(tx, row.beanId, {
    greenG: (row.batchG ?? 0) - (result.batchG ?? 0),
    roastedG: (result.roastedG ?? 0) - (row.roastedG ?? 0),
  });
  if (!moved.ok) return moved;
  await syncRoastMovement(tx, id);
  return ok(undefined);
}

/** Links the roast to another bean, moving its weights and its row between the two. */
export async function moveRoastToBean(
  tx: SqliteRemoteDatabase,
  id: RoastId,
  beanId: BeanId | null,
): Promise<Result<void, StorageError>> {
  const row = await tx.select(stockColumns).from(roasts).where(eq(roasts.id, id)).get();
  if (!row) return err({ kind: 'not-found', id });
  await tx.update(roasts).set({ beanId }).where(eq(roasts.id, id)).run();
  if (row.imported || row.beanId === beanId) return ok(undefined);
  // The beans went from one bag to the other: give them back, then take them again.
  const moved = { greenG: row.batchG ?? 0, roastedG: row.roastedG ?? 0 };
  if (row.beanId !== null) {
    const back = await moveStock(tx, row.beanId, {
      greenG: moved.greenG,
      roastedG: -moved.roastedG,
    });
    if (!back.ok) return back;
  }
  if (beanId !== null) {
    const taken = await moveStock(tx, beanId, { greenG: -moved.greenG, roastedG: moved.roastedG });
    if (!taken.ok) return taken;
  }
  await syncRoastMovement(tx, id);
  return ok(undefined);
}
