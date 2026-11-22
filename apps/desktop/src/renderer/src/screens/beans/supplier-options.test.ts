import { describe, expect, it } from 'vitest';
import { contactsOf, supplierOptions } from './supplier-options';

const FALCON = {
  id: 1,
  name: 'Falcon',
  website: 'https://www.falcon.coffee/shop',
  email: 'sales@falcon.coffee',
  phone: null,
  notes: null,
};

describe('supplierOptions', () => {
  it('lists None, then your suppliers with their site', () => {
    expect(supplierOptions([FALCON], '')).toEqual({
      options: [
        { value: '', label: 'None' },
        { value: 'Falcon', label: 'Falcon', detail: 'falcon.coffee' },
      ],
      value: '',
      isNew: false,
    });
  });

  it('picks a supplier you have whatever the case you typed', () => {
    expect(supplierOptions([FALCON], ' falcon')).toMatchObject({ value: 'Falcon', isNew: false });
  });

  it('adds a name not saved yet to the list, marked New', () => {
    const { options, value, isNew } = supplierOptions([FALCON], 'Nordic ');
    expect(value).toBe('Nordic');
    expect(isNew).toBe(true);
    expect(options.at(-1)).toEqual({ value: 'Nordic', label: 'Nordic', badge: 'New' });
  });
});

describe('contactsOf', () => {
  it('joins the email and phone it has', () => {
    expect(contactsOf(FALCON)).toBe('sales@falcon.coffee');
    expect(contactsOf({ email: 'a@b.example', phone: '+1 2' })).toBe('a@b.example · +1 2');
    expect(contactsOf({ email: null, phone: null })).toBe('');
  });
});
