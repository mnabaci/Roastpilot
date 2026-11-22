import { silentLogger } from '@roastpilot/core';
import { err, ok, type Supplier } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { openSupplierWebsite } from './open-supplier-website';

const supplier = (website: string | null): Supplier => ({
  id: 1,
  name: 'Falcon',
  website,
  email: null,
  phone: null,
  notes: null,
});

function deps(suppliers: Supplier[], openExternal = vi.fn(() => Promise.resolve())) {
  return {
    suppliers: { read: () => Promise.resolve(ok(suppliers)) },
    openExternal,
    logger: silentLogger,
  };
}

describe('openSupplierWebsite', () => {
  it("opens the supplier's saved website", async () => {
    const d = deps([supplier('https://falcon.coffee')]);
    expect(await openSupplierWebsite(1, d)).toEqual(ok(undefined));
    expect(d.openExternal).toHaveBeenCalledWith('https://falcon.coffee');
  });

  it('opens nothing without a website, or with one that is not a web address', async () => {
    for (const website of [null, 'file:///etc/passwd', 'javascript:alert(1)']) {
      const d = deps([supplier(website)]);
      expect(await openSupplierWebsite(1, d)).toEqual(err({ kind: 'no-website', id: 1 }));
      expect(d.openExternal).not.toHaveBeenCalled();
    }
  });

  it('says when the supplier is gone, storage failed or the browser would not open', async () => {
    expect(await openSupplierWebsite(2, deps([supplier('https://a.example')]))).toEqual(
      err({ kind: 'supplier-not-found', id: 2 }),
    );
    const unreadable = {
      ...deps([]),
      suppliers: {
        read: () => Promise.resolve(err({ kind: 'storage-failed' as const, message: 'disk' })),
      },
    };
    expect(await openSupplierWebsite(1, unreadable)).toEqual(
      err({ kind: 'storage-failed', message: 'disk' }),
    );
    const failing = deps(
      [supplier('https://a.example')],
      vi.fn(() => Promise.reject(new Error('no browser'))),
    );
    expect(await openSupplierWebsite(1, failing)).toEqual(err({ kind: 'open-failed' }));
  });
});
