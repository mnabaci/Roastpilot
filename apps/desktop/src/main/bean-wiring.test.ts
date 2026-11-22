import type { BeanRepository } from '@roastpilot/core';
import { IPC_CHANNELS, ok } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { createBeans } from './bean-wiring';
import { unavailableBeans, unavailableSuppliers } from './history/unavailable-repository';

const logger = () => {
  const l = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => l };
  return l;
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createBeans', () => {
  it('refreshes the windows with the beans as stored', async () => {
    const published: unknown[] = [];
    const repository: BeanRepository = {
      ...unavailableBeans('not in this test'),
      list: () => Promise.resolve(ok([])),
    };
    const { refreshBeans } = createBeans({
      repository,
      supplierRepository: {
        ...unavailableSuppliers('not in this test'),
        list: () => Promise.resolve(ok([])),
      },
      publish: (channel, payload) => published.push([channel, payload]),
      logger: logger(),
    });
    refreshBeans();
    await flush();
    // A bean's save may have added its supplier: the suppliers follow.
    expect(published).toEqual([
      [IPC_CHANNELS.beansChanged, []],
      [IPC_CHANNELS.suppliersChanged, []],
    ]);
  });

  it('logs a refresh that throws instead of losing it', async () => {
    const log = logger();
    const repository: BeanRepository = {
      ...unavailableBeans('not in this test'),
      list: () => Promise.reject(new Error('disk gone')),
    };
    const { refreshBeans } = createBeans({
      repository,
      supplierRepository: unavailableSuppliers('not in this test'),
      publish: vi.fn(),
      logger: log,
    });
    refreshBeans();
    await flush();
    expect(log.error).toHaveBeenCalledWith('beans.refresh-failed', expect.anything());
  });

  it("reads the beans again after a supplier's write: they show its name", async () => {
    const published: string[] = [];
    let beansRead = 0;
    const { suppliers } = createBeans({
      repository: {
        ...unavailableBeans('not in this test'),
        list: () => {
          beansRead += 1;
          return Promise.resolve(ok([]));
        },
      },
      supplierRepository: {
        ...unavailableSuppliers('not in this test'),
        list: () => Promise.resolve(ok([])),
        update: () => Promise.resolve(ok(undefined)),
      },
      publish: (channel) => published.push(channel),
      logger: logger(),
    });
    const fields = { name: 'Falcon', website: null, email: null, phone: null, notes: null };
    await suppliers.update({ id: 1, fields });
    await flush();
    expect(beansRead).toBe(1);
    expect(published).toContain(IPC_CHANNELS.beansChanged);
  });
});
