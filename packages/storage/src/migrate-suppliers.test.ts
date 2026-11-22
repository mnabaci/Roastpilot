import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { migrate, MIGRATIONS } from './migrate';

/** A database at schema 0013 with beans that name their suppliers as text. */
function at0013() {
  const db = new DatabaseSync(':memory:');
  migrate(db, MIGRATIONS.slice(0, 14));
  db.exec(`
    INSERT INTO beans (name, origin, process, supplier, archived) VALUES
      ('Guji', 'Ethiopia', 'washed', 'Falcon Specialty', 0),
      ('Huila', 'Colombia', 'washed', '  falcon specialty ', 1),
      ('Kiambu', 'Kenya', 'washed', 'Nordic Approach', 0),
      ('Santos', 'Brazil', 'natural', NULL, 0),
      ('Sidamo', 'Ethiopia', 'natural', '   ', 0),
      ('Cerrado', 'Brazil', 'natural', 'FALCON SPECIALTY', 0);
  `);
  return db;
}

describe('migrations 0014 and 0015: suppliers', () => {
  it('makes one supplier per name the beans use, whatever the case, and links every bean', () => {
    const db = at0013();
    expect(migrate(db)).toEqual({
      ok: true,
      value: { applied: ['0014_suppliers', '0015_drop_bean_supplier'] },
    });
    expect(db.prepare('SELECT id, name, website, email, phone FROM suppliers').all()).toEqual([
      { id: 1, name: 'Falcon Specialty', website: null, email: null, phone: null },
      { id: 2, name: 'Nordic Approach', website: null, email: null, phone: null },
    ]);
    expect(db.prepare('SELECT name, supplier_id FROM beans ORDER BY id').all()).toEqual([
      { name: 'Guji', supplier_id: 1 },
      { name: 'Huila', supplier_id: 1 },
      { name: 'Kiambu', supplier_id: 2 },
      { name: 'Santos', supplier_id: null },
      { name: 'Sidamo', supplier_id: null },
      { name: 'Cerrado', supplier_id: 1 },
    ]);
    const columns = db.prepare('PRAGMA table_info(beans)').all() as { name: string }[];
    expect(columns.map((c) => c.name)).not.toContain('supplier');
  });

  it('keeps names unique in any case, and empties a deleted supplier from its beans', () => {
    const db = at0013();
    migrate(db);
    expect(() => {
      db.exec("INSERT INTO suppliers (name) VALUES ('nordic approach')");
    }).toThrow();
    db.exec('PRAGMA foreign_keys = ON; DELETE FROM suppliers WHERE id = 2');
    expect(db.prepare("SELECT supplier_id FROM beans WHERE name = 'Kiambu'").get()).toEqual({
      supplier_id: null,
    });
  });
});
