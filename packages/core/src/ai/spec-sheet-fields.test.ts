import type { RawSpecSheet } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { isEmptySheet, specSheetFields } from './spec-sheet-fields';

const EMPTY: RawSpecSheet = {
  name: null,
  origin: null,
  process: null,
  species: null,
  variety: null,
  altitudeMinM: null,
  altitudeMaxM: null,
  densityGL: null,
  moisturePct: null,
  screen: null,
  decaf: null,
  supplier: null,
  tastingNotes: [],
};

describe('specSheetFields', () => {
  it('fills what a full sheet had', () => {
    expect(
      specSheetFields({
        name: 'Guji Natural',
        origin: 'Ethiopia',
        process: 'natural',
        species: 'arabica',
        variety: 'Heirloom',
        altitudeMinM: 1800,
        altitudeMaxM: 2000,
        densityGL: 760,
        moisturePct: 10.5,
        screen: 15,
        decaf: false,
        supplier: 'Falcon',
        tastingNotes: ['Blueberry', 'Dark Chocolate'],
      }),
    ).toEqual({
      name: 'Guji Natural',
      origin: 'Ethiopia',
      process: 'natural',
      species: 'arabica',
      variety: 'Heirloom',
      altitudeM: 1900,
      densityGL: 760,
      moisturePct: 10.5,
      screen: 15,
      decaf: false,
      supplier: 'Falcon',
      notes: 'Blueberry | Dark Chocolate',
    });
  });

  it('fills nothing from an empty sheet', () => {
    const fields = specSheetFields(EMPTY);
    expect(fields).toEqual({});
    expect(isEmptySheet(fields)).toBe(true);
  });

  it('takes the middle of an altitude range, rounded, or the one end given', () => {
    expect(specSheetFields({ ...EMPTY, altitudeMinM: 1850, altitudeMaxM: 1900 }).altitudeM).toBe(
      1875,
    );
    expect(specSheetFields({ ...EMPTY, altitudeMinM: 1601, altitudeMaxM: 1700 }).altitudeM).toBe(
      1651,
    );
    expect(specSheetFields({ ...EMPTY, altitudeMinM: 1700 }).altitudeM).toBe(1700);
    expect(specSheetFields({ ...EMPTY, altitudeMaxM: 2100 }).altitudeM).toBe(2100);
  });

  it('leaves out values the bean form would refuse, keeping the rest', () => {
    expect(
      specSheetFields({
        ...EMPTY,
        origin: 'Kenya',
        moisturePct: 150,
        densityGL: -3,
        screen: 0,
        altitudeMinM: -10,
        altitudeMaxM: -10,
      }),
    ).toEqual({ origin: 'Kenya' });
  });

  it('trims text and leaves out blank text', () => {
    expect(specSheetFields({ ...EMPTY, name: '  ', origin: ' Peru ', variety: '' })).toEqual({
      origin: 'Peru',
    });
  });

  it('leaves out names longer than the form takes', () => {
    expect(specSheetFields({ ...EMPTY, name: 'n'.repeat(121) })).toEqual({});
  });

  it('keeps decaf when the sheet says no', () => {
    expect(specSheetFields({ ...EMPTY, decaf: false })).toEqual({ decaf: false });
  });

  it('lists tasting notes, skipping blanks, and cuts a long list at a whole note', () => {
    expect(specSheetFields({ ...EMPTY, tastingNotes: [' Pecan ', '', 'Cocoa'] }).notes).toBe(
      'Pecan | Cocoa',
    );
    const long = Array.from({ length: 300 }, (_, i) => `Note ${String(i).padStart(10, '0')}`);
    const notes = specSheetFields({ ...EMPTY, tastingNotes: long }).notes ?? '';
    expect(notes.length).toBeLessThanOrEqual(4000);
    expect(notes.endsWith(long[notes.split(' | ').length - 1] ?? '')).toBe(true);
    expect(specSheetFields({ ...EMPTY, tastingNotes: ['  '] }).notes).toBeUndefined();
  });
});
