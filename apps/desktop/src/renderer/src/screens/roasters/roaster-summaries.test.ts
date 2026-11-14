import { describe, expect, it } from 'vitest';
import { SKYWALKER } from '../../test/roasters';
import { toRoasterDraft, type RoasterDraft } from './roaster-draft';
import { sectionSummary, type RoasterSection } from './roaster-summaries';

const say = (section: RoasterSection, change: Partial<RoasterDraft> = {}, unit: 'c' | 'f' = 'c') =>
  sectionSummary(section, { ...toRoasterDraft(SKYWALKER, unit), ...change }, unit);

describe('roaster card summaries', () => {
  it('sums up each card, numbers first', () => {
    expect({
      batch: say('batch'),
      limits: say('limits'),
      preheat: say('preheat'),
      drum: say('drum'),
      cooling: say('cooling'),
      tuning: say('tuning'),
    }).toMatchInlineSnapshot(`
      {
        "batch": "375 g ideal · 250–400 g",
        "cooling": "Bean cooler helps",
        "drum": "60 %",
        "limits": "240 °C max · 20 min max · 0 °C offset",
        "preheat": "2:30 first · 2:00 next",
        "tuning": "Steps 1.5 / 0.02 · Curve 1.5 / 0.05 · 45 s look-ahead · Preheat 5 / 0.02",
      }
    `);
  });

  it('reads in °F', () => {
    expect(say('limits', {}, 'f')).toMatch(/°F max · .* min max · .*°F offset$/);
  });

  it('leaves out a field that is empty while editing', () => {
    expect(say('batch', { batchMinG: '' })).toBe(`${SKYWALKER.batchIdealG} g ideal`);
    expect(say('preheat', { hold: '' })).toMatch(/^\d:\d\d next$/);
    expect(say('tuning', { targetKp: '', targetKi: '' })).not.toContain('Steps');
  });

  it('says whether the bean cooler helps', () => {
    expect(say('cooling', { coolerHelpsDrum: false })).toBe('Bean cooler off');
  });
});
