import type { BeanRepository } from '@roastpilot/core';
import { ok } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { createBeans } from './bean-wiring';
import { unavailableBeans } from './history/unavailable-repository';

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
      publish: (_channel, payload) => published.push(payload),
      logger: logger(),
    });
    refreshBeans();
    await flush();
    expect(published).toEqual([[]]);
  });

  it('logs a refresh that throws instead of losing it', async () => {
    const log = logger();
    const repository: BeanRepository = {
      ...unavailableBeans('not in this test'),
      list: () => Promise.reject(new Error('disk gone')),
    };
    const { refreshBeans } = createBeans({ repository, publish: vi.fn(), logger: log });
    refreshBeans();
    await flush();
    expect(log.error).toHaveBeenCalledWith('beans.refresh-failed', expect.anything());
  });
});
