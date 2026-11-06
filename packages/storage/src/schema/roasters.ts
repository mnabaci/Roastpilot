// Roaster records (docs/spec/data-model.md). Change only through a new migration (add-migration skill).
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const roasters = sqliteTable('roasters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  model: text('model', { enum: ['skywalker', 'simulator'] }).notNull(),
  /** JSON ConnectTarget. */
  connection: text('connection'),
  batchMinG: real('batch_min_g').notNull(),
  batchIdealG: real('batch_ideal_g').notNull(),
  batchMaxG: real('batch_max_g').notNull(),
  maxTempC: real('max_temp').notNull(),
  maxTimeS: real('max_time_s').notNull(),
  tempOffsetC: real('temp_offset').notNull(),
  /** The tray fan sits under the drum and helps cool it (0005). */
  coolerHelpsDrum: integer('cooler_helps_drum', { mode: 'boolean' }).notNull().default(false),
  /** JSON AutoTuning: gains, correction limit, preheat hold. */
  pid: text('pid').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull(),
});
