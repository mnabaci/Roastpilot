// Roaster records (docs/spec/data-model.md). Change only through a new migration (add-migration skill).
import { ROASTER_MODEL_IDS } from '@roastpilot/shared';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const roasters = sqliteTable('roasters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  /** Plain text in SQLite: the ids are checked in code (ADR 0024), so a new model needs no migration. */
  model: text('model', { enum: ROASTER_MODEL_IDS }).notNull(),
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
  /** The usual speed of a drum that has one, 5–100 % (0006). */
  drumSpeedPct: real('drum_speed_pct').notNull().default(60),
  /** JSON Tc4Wiring on a model that has wiring (a generic TC4), else NULL (0012). */
  wiring: text('wiring'),
  /** For air roasters: the fan never goes below this while heating; 0 is off (0012). */
  minFanHeatingPct: real('min_fan_heating_pct').notNull().default(0),
  /** JSON AutoTuning: gains, correction limit, preheat hold. */
  pid: text('pid').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull(),
});
