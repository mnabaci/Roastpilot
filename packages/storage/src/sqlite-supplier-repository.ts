import type { SupplierRepository } from '@roastpilot/core';
import {
  err,
  ok,
  SupplierSchema,
  supplierNamed,
  type Result,
  type StorageError,
  type Supplier,
  type SupplierError,
  type SupplierFields,
  type SupplierId,
} from '@roastpilot/shared';
import { count, eq } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { attempt } from './attempt';
import { beans } from './schema/beans';
import { suppliers } from './schema/suppliers';
import { transaction } from './transaction';

/** Every supplier, by name in any case; a row that doesn't check out is left out. */
export async function readSuppliers(db: SqliteRemoteDatabase): Promise<Supplier[]> {
  const rows = await db.select().from(suppliers).all();
  return rows
    .flatMap((row) => {
      const parsed = SupplierSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/**
 * The id of the supplier named `name` in any case, adding it when there is none
 * (docs/spec/data-model.md, Suppliers). Runs inside the caller's transaction.
 */
export async function supplierIdFor(
  tx: SqliteRemoteDatabase,
  name: string | null,
): Promise<SupplierId | null> {
  const wanted = name?.trim() ?? '';
  if (wanted === '') return null;
  const found = supplierNamed(await tx.select().from(suppliers).all(), wanted);
  if (found) return found.id;
  const row = await tx.insert(suppliers).values({ name: wanted }).returning().get();
  return row.id;
}

/** Suppliers in SQLite (docs/spec/data-model.md, Suppliers). */
export class SqliteSupplierRepository implements SupplierRepository {
  readonly #db: SqliteRemoteDatabase;

  constructor(db: SqliteRemoteDatabase) {
    this.#db = db;
  }

  list(): Promise<Result<Supplier[], StorageError>> {
    return attempt(() => readSuppliers(this.#db));
  }

  add(fields: SupplierFields): Promise<Result<SupplierId, SupplierError>> {
    return transaction<SupplierId, SupplierError>(this.#db, async (tx) => {
      if (supplierNamed(await tx.select().from(suppliers).all(), fields.name)) {
        return err({ kind: 'name-taken', name: fields.name });
      }
      const row = await tx.insert(suppliers).values(fields).returning().get();
      return ok(row.id);
    });
  }

  update(id: SupplierId, fields: SupplierFields): Promise<Result<undefined, SupplierError>> {
    return transaction<undefined, SupplierError>(this.#db, async (tx) => {
      const all = await tx.select().from(suppliers).all();
      if (!all.some((s) => s.id === id)) return err({ kind: 'not-found', id });
      const other = supplierNamed(
        all.filter((s) => s.id !== id),
        fields.name,
      );
      if (other) return err({ kind: 'name-taken', name: fields.name });
      await tx.update(suppliers).set(fields).where(eq(suppliers.id, id)).run();
      return ok(undefined);
    });
  }

  delete(id: SupplierId): Promise<Result<undefined, SupplierError>> {
    return transaction<undefined, SupplierError>(this.#db, async (tx) => {
      const named = await tx
        .select({ n: count() })
        .from(beans)
        .where(eq(beans.supplierId, id))
        .get();
      const n = named?.n ?? 0;
      if (n > 0) return err({ kind: 'has-beans', beans: n });
      const gone = await tx
        .delete(suppliers)
        .where(eq(suppliers.id, id))
        .returning({ id: suppliers.id })
        .all();
      return gone.length > 0 ? ok(undefined) : err({ kind: 'not-found', id });
    });
  }
}
