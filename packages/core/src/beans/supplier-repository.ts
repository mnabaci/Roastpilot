import type {
  Result,
  Supplier,
  SupplierError,
  SupplierFields,
  SupplierId,
  StorageError,
} from '@roastpilot/shared';

/** Who you buy from (docs/spec/data-model.md, Suppliers). Implemented in `storage`. */
export interface SupplierRepository {
  /** By name, in any case. */
  list(): Promise<Result<Supplier[], StorageError>>;
  /** `name-taken` when another supplier has the name in some case. */
  add(fields: SupplierFields): Promise<Result<SupplierId, SupplierError>>;
  update(id: SupplierId, fields: SupplierFields): Promise<Result<void, SupplierError>>;
  /** `has-beans` while any bean, archived ones too, names it. */
  delete(id: SupplierId): Promise<Result<void, SupplierError>>;
}
