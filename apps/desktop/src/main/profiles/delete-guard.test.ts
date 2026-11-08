import { describe, expect, it } from 'vitest';
import { deleteRefusal } from './delete-guard';

const guard = { isBuiltIn: (id: string) => id === 'light-steps', inUse: ['custom-auto'] };

describe('deleteRefusal', () => {
  it('lets your own profiles go when none is in use', () => {
    expect(deleteRefusal(['custom-a', 'custom-b'], guard)).toBeUndefined();
  });

  it('refuses them all for one built-in', () => {
    expect(deleteRefusal(['custom-a', 'light-steps'], guard)).toEqual({
      kind: 'built-in',
      id: 'light-steps',
    });
  });

  it('refuses them all for the one Auto uses or runs', () => {
    expect(deleteRefusal(['custom-a', 'custom-auto'], guard)).toEqual({
      kind: 'in-use',
      id: 'custom-auto',
    });
  });
});
