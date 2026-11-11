// A bean's stock log (docs/spec/data-model.md, Stock log; ADR 0023). Change only through a new
// migration (add-migration skill).
import type { StockKind } from '@roastpilot/shared';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { beans } from './beans';
import { roasts } from './roasts';

/** Everything that moved a bean's stock, one row each, with what it changed in grams. */
export const beanStockMovements = sqliteTable(
  'bean_stock_movements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    beanId: integer('bean_id')
      .notNull()
      .references(() => beans.id, { onDelete: 'cascade' }),
    /** A day (`2026-11-07`) for a purchase or a back-dated change, else an ISO moment. */
    at: text('at').notNull(),
    /** Plain text, no CHECK: zod checks it on the way out, so a new kind needs no migration. */
    kind: text('kind').$type<StockKind>().notNull(),
    greenG: real('green_g').notNull(),
    roastedG: real('roasted_g').notNull(),
    /** The roast, for `roasted`; a deleted roast leaves it empty and the row stays. */
    roastId: integer('roast_id').references(() => roasts.id, { onDelete: 'set null' }),
    /** Free text: why, for `taken`. */
    note: text('note'),
  },
  (table) => [
    index('bean_stock_movements_bean').on(table.beanId, table.at),
    index('bean_stock_movements_roast').on(table.roastId),
  ],
);
