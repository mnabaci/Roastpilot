// Saved roasts (docs/spec/data-model.md). Change only through a new migration (add-migration skill).
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const roasts = sqliteTable(
  'roasts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    mode: text('mode', { enum: ['manual', 'auto'] }).notNull(),
    /** JSON copy of the profile an Auto roast ran, with its schemaVersion. */
    profile: text('profile'),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    fcTimeS: real('fc_time_s'),
    dropTimeS: real('drop_time_s'),
    dropTemp: real('drop_temp'),
  },
  (table) => [index('roasts_started_at').on(table.startedAt)],
);

export const roastSamples = sqliteTable(
  'roast_samples',
  {
    roastId: integer('roast_id')
      .notNull()
      .references(() => roasts.id, { onDelete: 'cascade' }),
    tS: real('t_s').notNull(),
    /** JSON map of every channel, so new sensors need no schema change. */
    values: text('values').notNull(),
  },
  (table) => [index('roast_samples_roast').on(table.roastId, table.tS)],
);

export const roastEvents = sqliteTable(
  'roast_events',
  {
    roastId: integer('roast_id')
      .notNull()
      .references(() => roasts.id, { onDelete: 'cascade' }),
    tS: real('t_s').notNull(),
    type: text('type').notNull(),
    /** JSON, e.g. `{ "bt": 196 }`. */
    detail: text('detail')
      .notNull()
      .default(sql`'{}'`),
  },
  (table) => [index('roast_events_roast').on(table.roastId, table.tS)],
);
