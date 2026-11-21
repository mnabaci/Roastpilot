import { describe, expect, it } from 'vitest';
import { fillFromSheet, toBeanDraft } from './bean-draft';

const SHEET = {
  name: 'Guji Natural',
  origin: 'Ethiopia',
  process: 'natural' as const,
  species: 'arabica' as const,
  variety: 'Heirloom',
  altitudeM: 1900,
  densityGL: 760,
  moisturePct: 10.5,
  screen: 15,
  decaf: false,
  supplier: 'Falcon',
  notes: 'Blueberry | Cocoa',
};

describe('fillFromSheet', () => {
  it('fills every empty cell of a new bean, process included', () => {
    const { cells, count } = fillFromSheet(toBeanDraft(undefined), SHEET, { isNew: true });
    expect(cells).toEqual({
      name: 'Guji Natural',
      origin: 'Ethiopia',
      process: 'natural',
      species: 'arabica',
      variety: 'Heirloom',
      altitudeM: '1900',
      densityGL: '760',
      moisturePct: '10.5',
      screen: '15',
      supplier: 'Falcon',
      notes: 'Blueberry | Cocoa',
    });
    // Decaf no is what the form starts with: nothing to change.
    expect(count).toBe(11);
  });

  it('never changes a cell you typed', () => {
    const draft = { ...toBeanDraft(undefined), origin: 'Kenya', process: 'honey' as const };
    const { cells } = fillFromSheet(draft, SHEET, { isNew: true });
    expect(cells.origin).toBeUndefined();
    expect(cells.process).toBeUndefined();
  });

  it('leaves the name, process and decaf of a saved bean alone', () => {
    const draft = { ...toBeanDraft(undefined), name: '', origin: '' };
    const { cells } = fillFromSheet(draft, { ...SHEET, decaf: true }, { isNew: false });
    expect(cells).not.toHaveProperty('name');
    expect(cells).not.toHaveProperty('process');
    expect(cells).not.toHaveProperty('decaf');
    expect(cells.origin).toBe('Ethiopia');
  });

  it('sets decaf on a new bean when the sheet says yes', () => {
    expect(fillFromSheet(toBeanDraft(undefined), { decaf: true }, { isNew: true }).cells).toEqual({
      decaf: true,
    });
  });

  it('fills nothing from an empty sheet, or one that says what is there', () => {
    expect(fillFromSheet(toBeanDraft(undefined), {}, { isNew: true })).toEqual({
      cells: {},
      count: 0,
    });
    const full = { ...toBeanDraft(undefined), origin: 'Ethiopia' };
    expect(fillFromSheet(full, { origin: 'Ethiopia' }, { isNew: true }).count).toBe(0);
  });
});
