import {
  serializeError,
  type BeanRepository,
  type Logger,
  type SupplierRepository,
} from '@roastpilot/core';
import { IPC_CHANNELS, type IpcEventChannel, type IpcEventPayloads } from '@roastpilot/shared';
import { BeanService } from './beans/bean-service';
import { SupplierService } from './beans/supplier-service';

/**
 * Beans and their stock, and their suppliers (docs/spec/data-model.md), with a refresh that never
 * throws. Each follows the other: saving a bean may add its supplier, and a supplier's new name
 * shows on its beans.
 */
export function createBeans({
  repository,
  supplierRepository,
  publish,
  logger,
}: {
  repository: BeanRepository;
  supplierRepository: SupplierRepository;
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
  logger: Logger;
}): { beans: BeanService; suppliers: SupplierService; refreshBeans: () => void } {
  const refreshed = (what: string, refresh: () => Promise<void>) => () => {
    refresh().catch((error: unknown) => {
      logger.error(`${what}.refresh-failed`, { error: serializeError(error) });
    });
  };
  const suppliers: SupplierService = new SupplierService({
    repository: supplierRepository,
    onChange: (list) => {
      publish(IPC_CHANNELS.suppliersChanged, list);
    },
    onWritten: () => {
      refreshBeans();
    },
    logger: logger.child('suppliers'),
  });
  const refreshSuppliers = refreshed('suppliers', () => suppliers.refresh());
  const beans = new BeanService({
    repository,
    onChange: (list) => {
      publish(IPC_CHANNELS.beansChanged, list);
      refreshSuppliers();
    },
    logger: logger.child('beans'),
  });
  // A roast takes its batch off green stock, and its result adds to roasted stock.
  const refreshBeans = refreshed('beans', () => beans.refresh());
  return { beans, suppliers, refreshBeans };
}
