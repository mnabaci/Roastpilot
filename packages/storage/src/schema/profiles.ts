// Your own profiles (docs/spec/data-model.md). Change only through a new migration (add-migration skill).
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  /** JSON AutoProfile, with its schemaVersion; checked on the way in and out. */
  doc: text('doc').notNull(),
  updatedAt: text('updated_at').notNull(),
});
