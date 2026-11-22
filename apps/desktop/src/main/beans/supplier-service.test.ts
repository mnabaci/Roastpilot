import { silentLogger, type SupplierRepository } from '@roastpilot/core';
import { err, ok, type Supplier } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { unavailableSuppliers } from '../history/unavailable-repository';
import { SupplierService } from './supplier-service';

const FALCON: Supplier = {
  id: 1,
  name: 'Falcon',
  website: null,
  email: null,
  phone: null,
  notes: null,
};

function setup(repository: Partial<SupplierRepository> = {}) {
  const onChange = vi.fn();
  const onWritten = vi.fn();
  const service = new SupplierService({
    repository: {
      ...unavailableSuppliers('not in this test'),
      list: () => Promise.resolve(ok([FALCON])),
      ...repository,
    },
    onChange,
    onWritten,
    logger: silentLogger,
  });
  return { service, onChange, onWritten };
}

describe('SupplierService', () => {
  it('sends the new list and has the beans read again after a write', async () => {
    const { service, onChange, onWritten } = setup({ add: () => Promise.resolve(ok(1)) });
    const fields = { ...FALCON, id: undefined };
    expect(await service.add(fields)).toEqual(ok(1));
    expect(onChange).toHaveBeenCalledWith([FALCON]);
    expect(onWritten).toHaveBeenCalledOnce();
  });

  it('sends nothing after a refused write, and says why', async () => {
    const refused = err({ kind: 'has-beans' as const, beans: 2 });
    const { service, onChange, onWritten } = setup({ delete: () => Promise.resolve(refused) });
    expect(await service.delete(1)).toEqual(refused);
    expect(onChange).not.toHaveBeenCalled();
    expect(onWritten).not.toHaveBeenCalled();
  });

  it('lists none when storage cannot be read, so the screen still opens', async () => {
    const { service } = setup({ list: unavailableSuppliers('disk gone').list });
    expect(await service.list()).toEqual([]);
  });
});
