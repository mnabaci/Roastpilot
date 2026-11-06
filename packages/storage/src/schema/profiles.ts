// Your own profiles (docs/spec/data-model.md). Change only through a new migration (add-migration skill).
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { roasters } from './roasters';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  /** JSON AutoProfile, with its schemaVersion; checked on the way in and out. */
  doc: text('doc').notNull(),
  updatedAt: text('updated_at').notNull(),
  roasterId: integer('roaster_id').references(() => roasters.id),
});
