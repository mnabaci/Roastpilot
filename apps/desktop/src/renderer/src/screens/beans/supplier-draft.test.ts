import { describe, expect, it } from 'vitest';
import { beanCount, fromSupplierDraft, toSupplierDraft } from './supplier-draft';

const FALCON = {
  id: 1,
  name: 'Falcon',
  website: 'https://falcon.coffee',
  email: 'sales@falcon.coffee',
  phone: null,
  notes: null,
};

describe('supplier draft', () => {
  it('round-trips a supplier, an empty cell being no value', () => {
    const draft = toSupplierDraft(FALCON);
    expect(draft.phone).toBe('');
    expect(fromSupplierDraft(draft)).toEqual({ ok: true, value: { ...FALCON, id: undefined } });
  });

  it('trims what you typed', () => {
    const draft = { ...toSupplierDraft(undefined), name: ' Nordic ', phone: ' +47 123 ' };
    expect(fromSupplierDraft(draft)).toMatchObject({
      ok: true,
      value: { name: 'Nordic', phone: '+47 123', website: null },
    });
  });

  it('says what is wrong per cell: no name, a website that is not a web address, a bad email', () => {
    expect(
      fromSupplierDraft({
        name: ' ',
        website: 'falcon.coffee',
        email: 'falcon',
        phone: '',
        notes: '',
      }),
    ).toEqual({
      ok: false,
      error: {
        name: 'Enter a name',
        website: 'Enter a web address, starting with https://',
        email: 'Enter an email address, like sales@example.com',
      },
    });
  });

  it('counts beans in words', () => {
    expect([beanCount(0), beanCount(1), beanCount(3)]).toEqual(['0 beans', '1 bean', '3 beans']);
  });
});
