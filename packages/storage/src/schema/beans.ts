// Beans and purchases (docs/spec/data-model.md). Change only through a new migration (add-migration skill).
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const beans = sqliteTable('beans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  origin: text('origin').notNull(),
  process: text('process', { enum: ['washed', 'natural', 'honey', 'other'] }).notNull(),
  species: text('species', { enum: ['arabica', 'robusta', 'liberica', 'excelsa', 'other'] }),
  variety: text('variety'),
  altitudeM: real('altitude_m'),
  densityGL: real('density_g_l'),
  moisturePct: real('moisture_pct'),
  screen: real('screen'),
  decaf: integer('decaf', { mode: 'boolean' }).notNull().default(false),
  supplier: text('supplier'),
  link: text('link'),
  profileId: text('profile_id'),
  greenG: real('green_g').notNull().default(0),
  roastedG: real('roasted_g').notNull().default(0),
  lowStockG: real('low_stock_g').notNull().default(500),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
});

export const beanPurchases = sqliteTable('bean_purchases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  beanId: integer('bean_id')
    .notNull()
    .references(() => beans.id, { onDelete: 'cascade' }),
  purchasedAt: text('purchased_at').notNull(),
  grams: real('grams').notNull(),
  /** JSON BatchPlan: the plan picked with this stock. */
  batchPlan: text('batch_plan'),
});
