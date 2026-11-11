import { StockMovementSchema, type StockMovement } from '@roastpilot/shared';

/** A `bean_stock_movements` row as read. */
interface StockRow {
  at: string;
  kind: string;
  greenG: number;
  roastedG: number;
  roastId: number | null;
  note: string | null;
}

/**
 * The rows that check out as stock movements; one that doesn't (a kind this app doesn't know) is
 * dropped, so the caller can count and log it.
 */
export function toStockMovements(rows: readonly StockRow[]): StockMovement[] {
  return rows.flatMap(({ at, kind, greenG, roastedG, roastId, note }) => {
    const parsed = StockMovementSchema.safeParse({ at, kind, greenG, roastedG, roastId, note });
    return parsed.success ? [parsed.data] : [];
  });
}
