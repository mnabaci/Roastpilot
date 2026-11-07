import { describe, expect, it } from 'vitest';
import { CoachCard, NEW_SUGGESTION_EVERY_MS, type CardView } from './coach-card';
import type { CoachTip } from './coach-rule';

type SettingTip = Extract<CoachTip, { kind: 'setting' }>;
const heater = (from: number, to: number, reason = 'RoR 6.5 · step wants 8–12'): SettingTip => ({
  kind: 'setting',
  heater: { from, to },
  reason,
});
const firstCrack = (inS: number): CoachTip => ({ kind: 'first-crack-soon', inS });

const view = (tips: CoachTip[], nowMs: number, change: Partial<CardView> = {}): CardView => ({
  tips,
  nowMs,
  phaseIndex: 1,
  gaps: { heater: 10, fan: 0 },
  set: { heater: 65, fan: 30 },
  ...change,
});

describe('CoachCard', () => {
  it('shows the first tip under a new id, and nothing once no rule speaks', () => {
    const card = new CoachCard();
    expect(card.update(view([heater(65, 75), firstCrack(40)], 0))).toMatchObject({
      kind: 'setting',
      id: 1,
    });
    expect(card.shown).toMatchObject({ heater: { from: 65, to: 75 } });
    expect(card.update(view([], 1_000))).toBeUndefined();
    expect(card.shown).toBeNull();
  });

  it('keeps the same suggestion under its id', () => {
    const card = new CoachCard();
    card.update(view([heater(65, 75)], 0));
    expect(card.update(view([heater(65, 75, 'RoR falling')], 1_000))).toBeUndefined();
    expect(card.shown).toMatchObject({ id: 1, reason: 'RoR 6.5 · step wants 8–12' });
  });

  it('gives at most one new suggestion every 15 s', () => {
    const card = new CoachCard();
    card.update(view([heater(65, 75)], 0));
    expect(card.update(view([heater(65, 80)], NEW_SUGGESTION_EVERY_MS - 1))).toBeUndefined();
    expect(card.shown).toMatchObject({ id: 1, heater: { to: 75 } });
    expect(card.update(view([heater(65, 80)], NEW_SUGGESTION_EVERY_MS))).toMatchObject({
      id: 2,
      heater: { to: 80 },
    });
  });

  it('waits out the 15 s after a card went too', () => {
    const card = new CoachCard();
    card.update(view([heater(65, 75)], 0));
    card.update(view([], 1_000));
    expect(card.update(view([heater(65, 75)], 2_000))).toBeUndefined();
    expect(card.shown).toBeNull();
    expect(card.update(view([heater(65, 75)], NEW_SUGGESTION_EVERY_MS))).toMatchObject({ id: 2 });
  });

  it('drops a waiting suggestion that no longer starts from what is set', () => {
    const card = new CoachCard();
    card.update(view([heater(65, 75)], 0));
    expect(
      card.update(view([heater(70, 80)], 5_000, { set: { heater: 70, fan: 30 } })),
    ).toBeUndefined();
    expect(card.shown).toBeNull();
  });

  it('lets a heads-up speak while a new suggestion has to wait', () => {
    const card = new CoachCard();
    card.update(view([heater(65, 75)], 0));
    card.claim(1);
    expect(card.update(view([heater(65, 75), firstCrack(40)], 1_000))).toMatchObject({
      kind: 'first-crack-soon',
    });
  });

  it('counts a heads-up down under its id', () => {
    const card = new CoachCard();
    card.update(view([firstCrack(45)], 0));
    expect(card.update(view([firstCrack(40)], 5_000))).toBeUndefined();
    expect(card.shown).toEqual({ kind: 'first-crack-soon', id: 1, inS: 40 });
  });

  describe('Dismiss', () => {
    it('hides a suggestion for the rest of the phase', () => {
      const card = new CoachCard();
      card.update(view([heater(65, 75)], 0));
      expect(card.dismiss(1)).toMatchObject({ kind: 'setting' });
      expect(card.shown).toBeNull();
      card.update(view([heater(65, 75)], 60_000, { gaps: { heater: 19, fan: 9 } }));
      expect(card.shown).toBeNull();
    });

    it('lets the next phase speak again', () => {
      const card = new CoachCard();
      card.update(view([heater(65, 75)], 0));
      card.dismiss(1);
      expect(card.update(view([heater(65, 75)], 60_000, { phaseIndex: 2 }))).toMatchObject({
        id: 2,
      });
    });

    it('speaks again once Auto wants 10 points more than the one dismissed', () => {
      const card = new CoachCard();
      card.update(view([heater(65, 75)], 0));
      card.dismiss(1);
      expect(
        card.update(view([heater(65, 85)], 60_000, { gaps: { heater: 20, fan: 0 } })),
      ).toMatchObject({ heater: { to: 85 } });
    });

    it('counts the other output from how far it was when dismissed', () => {
      const card = new CoachCard();
      card.update(view([heater(65, 75)], 0, { gaps: { heater: 10, fan: 4 } }));
      card.dismiss(1);
      const fan: CoachTip = { kind: 'setting', fan: { from: 30, to: 43 }, reason: 'Drying' };
      expect(card.update(view([fan], 60_000, { gaps: { heater: 10, fan: 13 } }))).toBeUndefined();
      expect(card.update(view([fan], 61_000, { gaps: { heater: 10, fan: 14 } }))).toMatchObject({
        fan: { to: 43 },
      });
    });

    it('keeps a heads-up dismissed for the rest of the roast, but not the other ones', () => {
      const card = new CoachCard();
      card.update(view([firstCrack(45)], 0));
      card.dismiss(1);
      expect(card.update(view([firstCrack(40)], 5_000))).toBeUndefined();
      expect(card.shown).toBeNull();
      const drop: CoachTip = { kind: 'drop-soon', inS: 30, devTimeS: 90 };
      expect(card.update(view([drop], 300_000))).toMatchObject({ kind: 'drop-soon', id: 2 });
    });

    it('leaves a card that has already changed', () => {
      const card = new CoachCard();
      card.update(view([heater(65, 75)], 0));
      expect(card.dismiss(7)).toBeUndefined();
      expect(card.shown).toMatchObject({ id: 1 });
    });

    it('forgets every dismissal for a new roast, but never reuses an id', () => {
      const card = new CoachCard();
      card.update(view([firstCrack(45)], 0));
      card.dismiss(1);
      card.reset();
      expect(card.update(view([firstCrack(45)], 0))).toMatchObject({ id: 2 });
    });
  });

  describe('claim', () => {
    it('takes the suggestion with this id off the card', () => {
      const card = new CoachCard();
      card.update(view([heater(65, 75)], 0));
      expect(card.claim(1)).toMatchObject({ heater: { from: 65, to: 75 } });
      expect(card.shown).toBeNull();
      expect(card.claim(1)).toBeUndefined();
    });

    it('refuses a heads-up or another id', () => {
      const card = new CoachCard();
      card.update(view([firstCrack(45)], 0));
      expect(card.claim(1)).toBeUndefined();
      expect(card.shown).not.toBeNull();
    });
  });
});
