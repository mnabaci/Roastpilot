import { createLogger } from '@roastpilot/core';
import type { SupplierFields } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './open-database';
import { drizzleOn } from './proxy-db';
import { SqliteSupplierRepository } from './sqlite-supplier-repository';

const FALCON: SupplierFields = {
  name: 'Falcon',
  website: 'https://falcon.coffee',
  email: 'sales@falcon.coffee',
  phone: '+44 1234 567890',
  notes: null,
};

function setup() {
  const opened = openDatabase(':memory:', createLogger({ write: () => undefined }, 'storage'));
  if (!opened.ok) throw new Error(opened.error.kind);
  return { sqlite: opened.value, suppliers: new SqliteSupplierRepository(drizzleOn(opened.value)) };
}

describe('SqliteSupplierRepository', () => {
  it('adds suppliers and lists them by name, whatever the case', async () => {
    const { suppliers } = setup();
    await suppliers.add(FALCON);
    await suppliers.add({ ...FALCON, name: 'aurora' });
    const list = await suppliers.list();
    expect(list.ok && list.value).toEqual([
      { ...FALCON, name: 'aurora', id: 2 },
      { ...FALCON, id: 1 },
    ]);
  });

  it('refuses a second supplier with the same name in another case', async () => {
    const { suppliers } = setup();
    await suppliers.add(FALCON);
    expect(await suppliers.add({ ...FALCON, name: 'FALCON ' })).toEqual({
      ok: false,
      error: { kind: 'name-taken', name: 'FALCON ' },
    });
  });

  it("changes a supplier's details, its own name's case too, but not to another's name", async () => {
    const { suppliers } = setup();
    await suppliers.add(FALCON);
    await suppliers.add({ ...FALCON, name: 'Nordic' });
    expect(await suppliers.update(1, { ...FALCON, name: 'FALCON', phone: null })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await suppliers.update(1, { ...FALCON, name: 'nordic' })).toEqual({
      ok: false,
      error: { kind: 'name-taken', name: 'nordic' },
    });
    expect(await suppliers.update(9, FALCON)).toEqual({
      ok: false,
      error: { kind: 'not-found', id: 9 },
    });
    const list = await suppliers.list();
    expect(list.ok && list.value[0]).toEqual({ ...FALCON, id: 1, name: 'FALCON', phone: null });
  });

  it('deletes a supplier no bean names, and refuses one that archived beans still name', async () => {
    const { suppliers, sqlite } = setup();
    await suppliers.add(FALCON);
    await suppliers.add({ ...FALCON, name: 'Nordic' });
    sqlite.exec(`INSERT INTO beans (name, origin, process, supplier_id, archived) VALUES
      ('Guji', 'Ethiopia', 'washed', 1, 1), ('Huila', 'Colombia', 'washed', 1, 0)`);
    expect(await suppliers.delete(1)).toEqual({
      ok: false,
      error: { kind: 'has-beans', beans: 2 },
    });
    expect(await suppliers.delete(2)).toEqual({ ok: true, value: undefined });
    expect(await suppliers.delete(2)).toEqual({ ok: false, error: { kind: 'not-found', id: 2 } });
  });

  it('returns a typed error when storage fails', async () => {
    const { suppliers, sqlite } = setup();
    sqlite.exec('DROP TABLE beans; DROP TABLE suppliers');
    expect(await suppliers.list()).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
    expect(await suppliers.add(FALCON)).toMatchObject({
      ok: false,
      error: { kind: 'storage-failed' },
    });
  });
});
