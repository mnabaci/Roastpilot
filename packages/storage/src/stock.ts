import { err, ok, type Result, type StorageError } from '@roastpilot/shared';
import { eq, sql } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { beans } from './schema/beans';

/**
 * Moves a bean's stock by a difference; it stops at 0. `not-found` when there is no such bean, so
 * the transaction around it rolls back instead of losing the move.
 */
export async function moveStock(
  db: SqliteRemoteDatabase,
  beanId: number,
  { greenG = 0, roastedG = 0 },
): Promise<Result<void, StorageError>> {
  const updated = await db
    .update(beans)
    .set({
      greenG: sql`max(0, ${beans.greenG} + ${greenG})`,
      roastedG: sql`max(0, ${beans.roastedG} + ${roastedG})`,
    })
    .where(eq(beans.id, beanId))
    .returning({ id: beans.id })
    .all();
  return updated.length > 0 ? ok(undefined) : err({ kind: 'not-found', id: beanId });
}
