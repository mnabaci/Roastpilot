import type {
  AddStock,
  AdjustStock,
  Bean,
  BeanFields,
  BeanId,
  ProfileId,
  Result,
  StockMovement,
  StorageError,
} from '@roastpilot/shared';

/** Beans and their stock (docs/spec/batch-and-stock.md). Implemented in `storage`. */
export interface BeanRepository {
  /** Archived ones too, as their roasts keep the name. */
  list(): Promise<Result<Bean[], StorageError>>;
  add(fields: BeanFields): Promise<Result<BeanId, StorageError>>;
  /** New beans with no stock, each with its profile, all or nothing (an import). Ids in order. */
  addAll(
    beans: readonly { fields: BeanFields; profileId: ProfileId | null }[],
  ): Promise<Result<BeanId[], StorageError>>;
  update(
    id: BeanId,
    fields: BeanFields,
    profileId: ProfileId | null,
  ): Promise<Result<void, StorageError>>;
  setArchived(id: BeanId, archived: boolean): Promise<Result<void, StorageError>>;
  addStock(stock: AddStock): Promise<Result<void, StorageError>>;
  /** The stock as it now is, keeping what changed as an adjustment. */
  adjustStock(stock: AdjustStock): Promise<Result<void, StorageError>>;
  /** Purchases, roasts made here and adjustments of one bean, oldest first. */
  stockHistory(id: BeanId): Promise<Result<StockMovement[], StorageError>>;
}
