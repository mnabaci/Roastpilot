import { serializeError, type BeanRepository, type Logger } from '@roastpilot/core';
import { IPC_CHANNELS, type IpcEventChannel, type IpcEventPayloads } from '@roastpilot/shared';
import { BeanService } from './beans/bean-service';

/** Beans and their stock (docs/spec/data-model.md), and a refresh that never throws. */
export function createBeans({
  repository,
  publish,
  logger,
}: {
  repository: BeanRepository;
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
  logger: Logger;
}): { beans: BeanService; refreshBeans: () => void } {
  const beans = new BeanService({
    repository,
    onChange: (list) => {
      publish(IPC_CHANNELS.beansChanged, list);
    },
    logger: logger.child('beans'),
  });
  return {
    beans,
    // A roast takes its batch off green stock, and its result adds to roasted stock.
    refreshBeans: () => {
      beans.refresh().catch((error: unknown) => {
        logger.error('beans.refresh-failed', { error: serializeError(error) });
      });
    },
  };
}
