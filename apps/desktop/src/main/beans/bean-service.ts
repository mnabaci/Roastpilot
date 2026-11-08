import type { BeanRepository, Logger } from '@roastpilot/core';
import {
  BeanFieldsSchema,
  err,
  ok,
  NO_ROAST_SETUP,
  type AddStock,
  type AdjustStock,
  type Bean,
  type BeanFields,
  type BeanId,
  type ProfileId,
  type Result,
  type RoastSetup,
  type StorageError,
  type UpdateBean,
} from '@roastpilot/shared';

export interface BeanServiceDeps {
  repository: BeanRepository;
  onChange: (beans: Bean[]) => void;
  logger: Logger;
}

/** Beans and what the next roast is of (docs/spec/beans-favourites-ghost.md). */
export class BeanService {
  readonly #deps: BeanServiceDeps;
  /** Stays until changed: the next batch is often the same bean. */
  #setup: RoastSetup = NO_ROAST_SETUP;

  constructor(deps: BeanServiceDeps) {
    this.#deps = deps;
  }

  get setup(): RoastSetup {
    return this.#setup;
  }

  setSetup(setup: RoastSetup): void {
    this.#setup = setup;
    this.#deps.logger.info('beans.setup-changed', { ...setup });
  }

  /** Empty, logged, when storage can't be read, so the screen still opens. */
  async list(): Promise<Bean[]> {
    const listed = await this.#deps.repository.list();
    if (listed.ok) return listed.value;
    this.#deps.logger.error('beans.list-failed', { error: listed.error });
    return [];
  }

  /** Every bean, archived ones too, or why they can't be read (logged). */
  async read(): Promise<Result<Bean[], StorageError>> {
    const listed = await this.#deps.repository.list();
    if (!listed.ok) this.#deps.logger.warn('beans.read-failed', { error: listed.error });
    return listed;
  }

  /** One bean, archived ones too; `not-found` when there's no such bean. */
  async find(id: BeanId): Promise<Result<Bean, StorageError>> {
    const listed = await this.read();
    if (!listed.ok) return listed;
    const bean = listed.value.find((b) => b.id === id);
    return bean ? ok(bean) : err({ kind: 'not-found', id });
  }

  /** Makes `profileId` the bean's own profile, keeping everything else about it. */
  async linkProfile(bean: Bean, profileId: ProfileId): Promise<Result<void, StorageError>> {
    const fields = BeanFieldsSchema.parse(bean);
    return this.#after(
      'profile-linked',
      await this.#deps.repository.update(bean.id, fields, profileId),
    );
  }

  /** Stock moved outside this service: a roast started, or its result was saved. */
  async refresh(): Promise<void> {
    this.#deps.onChange(await this.list());
  }

  async #after<T>(
    action: string,
    written: Result<T, StorageError>,
  ): Promise<Result<T, StorageError>> {
    if (written.ok) {
      this.#deps.logger.info(`beans.${action}`);
      await this.refresh();
    } else {
      this.#deps.logger.warn('beans.write-failed', { action, error: written.error });
    }
    return written;
  }

  async add(fields: BeanFields): Promise<Result<BeanId, StorageError>> {
    return this.#after('added', await this.#deps.repository.add(fields));
  }

  /** Imported beans, all or nothing; their ids in order. */
  async addAll(
    beans: readonly { fields: BeanFields; profileId: ProfileId | null }[],
  ): Promise<Result<BeanId[], StorageError>> {
    return this.#after('imported', await this.#deps.repository.addAll(beans));
  }

  async update({ id, fields, profileId }: UpdateBean): Promise<Result<void, StorageError>> {
    return this.#after('updated', await this.#deps.repository.update(id, fields, profileId));
  }

  async setArchived(request: {
    id: BeanId;
    archived: boolean;
  }): Promise<Result<void, StorageError>> {
    const { id, archived } = request;
    return this.#after('archived', await this.#deps.repository.setArchived(id, archived));
  }

  async addStock(stock: AddStock): Promise<Result<void, StorageError>> {
    return this.#after('stock-added', await this.#deps.repository.addStock(stock));
  }

  async adjustStock(stock: AdjustStock): Promise<Result<void, StorageError>> {
    return this.#after('stock-adjusted', await this.#deps.repository.adjustStock(stock));
  }
}
