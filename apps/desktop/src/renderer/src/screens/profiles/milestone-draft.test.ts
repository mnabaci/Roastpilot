import type { Milestones } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import {
  addMilestonePoint,
  fromMilestoneDraft,
  removeMilestonePoint,
  toMilestoneDraft,
} from './milestone-draft';

const LIGHT: Milestones = {
  chargeC: 180,
  turningPoint: { tS: 64, c: 92 },
  dryEnd: { tS: 305, c: 150 },
  firstCrack: { tS: 573, c: 191 },
  drop: { tS: 663, c: 197 },
  extras: [],
};

describe('milestone draft', () => {
  it('shows the milestones as typed text and reads them back', () => {
    const draft = toMilestoneDraft(LIGHT);
    expect(draft.chargeC).toBe('180');
    expect(draft.rows.turningPoint).toEqual({ time: '1:04', c: '92' });
    expect(fromMilestoneDraft(draft)).toEqual({ ok: true, value: LIGHT });
  });

  it('says what is wrong with a cell, as typed', () => {
    const draft = toMilestoneDraft(LIGHT);
    const typed = { ...draft, rows: { ...draft.rows, dryEnd: { time: '5', c: 'warm' } } };
    expect(fromMilestoneDraft(typed)).toEqual({
      ok: false,
      error: { 'dryEnd.time': 'Enter a time like 1:30', 'dryEnd.c': 'Enter a number' },
    });
  });

  it('puts each milestone rule on its cell', () => {
    const draft = toMilestoneDraft(LIGHT);
    const late = { ...draft, rows: { ...draft.rows, firstCrack: { time: '9:33', c: '140' } } };
    expect(fromMilestoneDraft(late)).toEqual({
      ok: false,
      error: { 'firstCrack.c': 'Warmer than 150 °C at 5:05' },
    });
    const extra = addMilestonePoint(draft);
    const outside = { ...extra, extras: [{ time: '0:30', c: '120' }] };
    expect(fromMilestoneDraft(outside)).toEqual({
      ok: false,
      error: { 'extras.0.time': 'Between 1:04 and 11:03' },
    });
  });

  it('adds your point halfway between dry end and first crack, and removes it', () => {
    const draft = addMilestonePoint(toMilestoneDraft(LIGHT));
    expect(draft.extras).toEqual([{ time: '7:19', c: '171' }]);
    expect(fromMilestoneDraft(draft).ok).toBe(true);
    expect(removeMilestonePoint(draft, 0).extras).toEqual([]);
  });

  it('adds an empty point when there is nothing sensible to put it between', () => {
    const draft = toMilestoneDraft(LIGHT);
    const late = { ...draft, rows: { ...draft.rows, dryEnd: { time: '10:00', c: '150' } } };
    expect(addMilestonePoint(late).extras).toEqual([{ time: '', c: '' }]);
    const typo = { ...draft, rows: { ...draft.rows, firstCrack: { time: 'x', c: '191' } } };
    expect(addMilestonePoint(typo).extras).toEqual([{ time: '', c: '' }]);
  });
});
