import { supplierNamed } from '@roastpilot/shared';
import type { DatabaseSync } from 'node:sqlite';

/**
 * Migration 0014's data step: every supplier the beans name becomes one record, linked from its
 * beans (docs/spec/data-model.md, Suppliers). Names that differ only in case or outer spaces are
 * one, by the app's own rule (`supplierNamed`), so "Çağ Kahve" and "ÇAĞ KAHVE" are one too, which
 * SQLite's `lower()` (A–Z only) would split. Spelled as the oldest bean spelled it.
 */
export function linkSuppliers(db: DatabaseSync): void {
  const beans = db
    .prepare("SELECT id, supplier FROM beans WHERE trim(coalesce(supplier, '')) <> '' ORDER BY id")
    .all() as { id: number; supplier: string }[];
  const added: { id: number; name: string }[] = [];
  const insert = db.prepare('INSERT INTO suppliers (name) VALUES (?)');
  const link = db.prepare('UPDATE beans SET supplier_id = ? WHERE id = ?');
  for (const bean of beans) {
    let supplier = supplierNamed(added, bean.supplier);
    if (!supplier) {
      const name = bean.supplier.trim();
      supplier = { id: Number(insert.run(name).lastInsertRowid), name };
      added.push(supplier);
    }
    link.run(supplier.id, bean.id);
  }
}
