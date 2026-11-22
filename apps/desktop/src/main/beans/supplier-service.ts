import type { Logger, SupplierRepository } from '@roastpilot/core';
import type {
  Result,
  StorageError,
  Supplier,
  SupplierError,
  SupplierFields,
  SupplierId,
  UpdateSupplier,
} from '@roastpilot/shared';

export interface SupplierServiceDeps {
  repository: SupplierRepository;
  /** The windows' list of suppliers. */
  onChange: (suppliers: Supplier[]) => void;
  /** After a supplier is written: beans show its name, so they are read again. */
  onWritten: () => void;
  logger: Logger;
}

/** Who you buy from, picked on each bean (docs/spec/beans-favourites-ghost.md, Suppliers). */
export class SupplierService {
  readonly #deps: SupplierServiceDeps;

  constructor(deps: SupplierServiceDeps) {
    this.#deps = deps;
  }

  /** Empty, logged, when storage can't be read, so the screen still opens. */
  async list(): Promise<Supplier[]> {
    const listed = await this.read();
    return listed.ok ? listed.value : [];
  }

  /** Every supplier, or why they can't be read (logged). */
  async read(): Promise<Result<Supplier[], StorageError>> {
    const listed = await this.#deps.repository.list();
    if (!listed.ok) this.#deps.logger.error('suppliers.list-failed', { error: listed.error });
    return listed;
  }

  /** Sends the list to the windows: a bean's save may have added one. */
  async refresh(): Promise<void> {
    this.#deps.onChange(await this.list());
  }

  async #after<T>(
    action: string,
    written: Result<T, SupplierError>,
  ): Promise<Result<T, SupplierError>> {
    if (written.ok) {
      this.#deps.logger.info(`suppliers.${action}`);
      await this.refresh();
      this.#deps.onWritten();
    } else {
      this.#deps.logger.warn('suppliers.write-failed', { action, error: written.error });
    }
    return written;
  }

  async add(fields: SupplierFields): Promise<Result<SupplierId, SupplierError>> {
    return this.#after('added', await this.#deps.repository.add(fields));
  }

  async update({ id, fields }: UpdateSupplier): Promise<Result<void, SupplierError>> {
    return this.#after('updated', await this.#deps.repository.update(id, fields));
  }

  async delete(id: SupplierId): Promise<Result<void, SupplierError>> {
    return this.#after('deleted', await this.#deps.repository.delete(id));
  }
}
