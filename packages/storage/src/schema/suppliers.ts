// Who you buy green coffee from (docs/spec/data-model.md, Suppliers). Change only through a new
// migration (add-migration skill).
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** One per supplier; beans link to it by `beans.supplier_id`. */
export const suppliers = sqliteTable(
  'suppliers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    /** Its own site, http or https; a bean's order link is that bean's page. */
    website: text('website'),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
  },
  // One supplier per name, whatever its case ("Falcon" and "falcon" are one).
  (table) => [uniqueIndex('suppliers_name').on(sql`lower(${table.name})`)],
);
