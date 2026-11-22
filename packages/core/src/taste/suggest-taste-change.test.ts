import { PROFILE_SCHEMA_VERSION, type AutoProfile, type TasteTag } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import type { ReportFinding } from '../history/roast-report/report-types';
import { applyTasteChange, suggestTasteChange, tasteInput } from './suggest-taste-change';
import type { TasteInput, TasteRule } from './taste-rule';

const PROFILE: AutoProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'test',
  name: 'Test',
  needsCalibration: false,
  batchG: 350,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 105,
  capC: 215,
  curve: [
    { tS: 0, c: 180 },
    { tS: 540, c: 196 },
    { tS: 660, c: 210 },
  ],
  phases: [{ name: 'Roast', heat: { mode: 'fixed', pct: 60 }, fanPct: 30, next: { on: 'end' } }],
};

/** A tasted Auto roast: first crack 9:00, drop 10:45 (1:45 development, 16.7 %). */
function input(tags: TasteTag[], over: Partial<TasteInput> = {}): TasteInput {
  return {
    tags: new Set(tags),
    profile: PROFILE,
    developmentS: 105,
    developmentShare: 105 / 645,
    totalS: 645,
    findings: [],
    ...over,
  };
}

const stall: ReportFinding = {
  kind: 'stall',
  atS: 372,
  durationS: 40,
  minRor: 2.1,
  guarded: false,
};
const crash: ReportFinding = { kind: 'crash', atS: 560, fromRor: 9, toRor: 3 };

describe('suggestTasteChange', () => {
  it('says nothing with no tags ticked', () => {
    expect(suggestTasteChange(input([]))).toBeUndefined();
  });

  it('offers the star for sweet and balanced alone, profile or not', () => {
    const balanced = { kind: 'none', reason: { kind: 'balanced' }, offerStar: true };
    expect(suggestTasteChange(input(['balanced']))).toEqual(balanced);
    expect(suggestTasteChange(input(['balanced'], { profile: undefined }))).toEqual(balanced);
  });

  it('reads the other tags when balanced comes with them', () => {
    expect(suggestTasteChange(input(['balanced', 'sour']))).toMatchObject({
      kind: 'change',
      change: { field: 'devTimeS' },
    });
  });

  it('changes nothing on mixed signals, even without a profile', () => {
    const mixed = { kind: 'none', reason: { kind: 'mixed' } };
    expect(suggestTasteChange(input(['sour', 'bitter']))).toEqual(mixed);
    expect(suggestTasteChange(input(['thin', 'roasty'], { profile: undefined }))).toEqual(mixed);
  });

  it('asks for an Auto roast when there is no profile to change', () => {
    for (const tag of ['sour', 'bitter', 'flat'] as const) {
      expect(suggestTasteChange(input([tag], { profile: undefined }))).toEqual({
        kind: 'none',
        reason: { kind: 'needs-auto' },
      });
    }
  });

  const capDrop: ReportFinding = { kind: 'cap-drop', atS: 640, capC: 215, shortS: 20 };

  describe('bitter or roasty', () => {
    it('shortens development by 15 s from 15 % of the roast', () => {
      const change = { field: 'devTimeS', from: 105, to: 90 };
      expect(suggestTasteChange(input(['bitter']))).toEqual({
        kind: 'change',
        change,
        reason: { kind: 'over-developed' },
      });
      // 14.6 % reads 15 %, as the report shows it.
      expect(suggestTasteChange(input(['roasty'], { developmentShare: 0.146 }))).toMatchObject({
        change,
      });
    });

    it('drops 3 °C cooler under 15 %, where shorter would turn it sour', () => {
      expect(suggestTasteChange(input(['roasty'], { developmentShare: 0.14 }))).toEqual({
        kind: 'change',
        change: { field: 'capC', from: 215, to: 212 },
        reason: { kind: 'drop-cooler' },
      });
    });

    it('drops cooler when the BT cap ended the roast, as development never ran out', () => {
      expect(suggestTasteChange(input(['bitter'], { findings: [capDrop] }))).toMatchObject({
        change: { field: 'capC', to: 212 },
      });
    });

    it('needs a first crack', () => {
      expect(suggestTasteChange(input(['bitter'], { developmentShare: undefined }))).toEqual({
        kind: 'none',
        reason: { kind: 'no-first-crack' },
      });
    });
  });

  describe('sour, grassy or thin', () => {
    it('lengthens development by 15 s under 20 %', () => {
      for (const tag of ['sour', 'grassy', 'thin'] as const) {
        expect(suggestTasteChange(input([tag]))).toEqual({
          kind: 'change',
          change: { field: 'devTimeS', from: 105, to: 120 },
          reason: { kind: 'under-developed' },
        });
      }
    });

    it('drops 3 °C hotter when the BT cap ended the roast before its development time', () => {
      expect(suggestTasteChange(input(['sour'], { findings: [capDrop] }))).toEqual({
        kind: 'change',
        change: { field: 'capC', from: 215, to: 218 },
        reason: { kind: 'cap-ended' },
      });
    });

    it('judges the share as shown: 19.6 % reads 20 %, already developed', () => {
      expect(suggestTasteChange(input(['sour'], { developmentShare: 0.196 }))).toEqual({
        kind: 'none',
        reason: { kind: 'already-developed', share: 0.196 },
      });
      expect(suggestTasteChange(input(['sour'], { developmentShare: 0.194 }))).toMatchObject({
        kind: 'change',
      });
    });

    it('says development is already long even when the cap ended the roast', () => {
      expect(
        suggestTasteChange(input(['sour'], { developmentShare: 0.22, findings: [capDrop] })),
      ).toMatchObject({ kind: 'none', reason: { kind: 'already-developed' } });
    });

    it('needs a first crack', () => {
      expect(suggestTasteChange(input(['grassy'], { developmentShare: undefined }))).toEqual({
        kind: 'none',
        reason: { kind: 'no-first-crack' },
      });
    });
  });

  describe('flat or baked', () => {
    it('points at a stall or crash the report found, the first one', () => {
      expect(suggestTasteChange(input(['flat'], { findings: [stall, crash] }))).toEqual({
        kind: 'none',
        reason: { kind: 'after-finding', finding: 'stall', atS: 372 },
      });
      expect(suggestTasteChange(input(['baked'], { findings: [crash] }))).toEqual({
        kind: 'none',
        reason: { kind: 'after-finding', finding: 'crash', atS: 560 },
      });
    });

    it('charges 5 °C hotter in a roast over 12:00 with neither', () => {
      const gap: ReportFinding = { kind: 'gap', fromS: 100, toS: 130 };
      expect(suggestTasteChange(input(['baked'], { findings: [gap], totalS: 760 }))).toEqual({
        kind: 'change',
        change: { field: 'chargeC', from: 180, to: 185 },
        reason: { kind: 'slow-roast', totalS: 760 },
      });
    });

    it('changes nothing in a roast of 12:00 or less: likely not the roast', () => {
      for (const totalS of [645, 720]) {
        expect(suggestTasteChange(input(['flat'], { totalS }))).toEqual({
          kind: 'none',
          reason: { kind: 'check-beans' },
        });
      }
    });

    it('says nothing without an end to the roast', () => {
      expect(suggestTasteChange(input(['flat'], { totalS: undefined }))).toBeUndefined();
    });
  });

  it('takes the rows in order: over before under before flat', () => {
    expect(suggestTasteChange(input(['bitter', 'flat']))).toMatchObject({
      change: { field: 'devTimeS', to: 90 },
    });
    expect(suggestTasteChange(input(['sour', 'baked']))).toMatchObject({
      change: { field: 'devTimeS', to: 120 },
    });
  });

  describe('limits', () => {
    const atLimit = (field: string, from: number, to: number) => ({
      kind: 'none',
      reason: { kind: 'at-limit', field, from, to },
    });

    it('keeps development within 0:30–10:00', () => {
      const long = { ...PROFILE, devTimeS: 600 };
      expect(suggestTasteChange(input(['sour'], { profile: long }))).toEqual(
        atLimit('devTimeS', 600, 615),
      );
      const short = { ...PROFILE, devTimeS: 40 };
      expect(suggestTasteChange(input(['bitter'], { profile: short }))).toEqual(
        atLimit('devTimeS', 40, 25),
      );
    });

    it('keeps charge within its range, and says when the cap is in the way', () => {
      const hot = { ...PROFILE, chargeC: 228, capC: 235 };
      expect(suggestTasteChange(input(['flat'], { profile: hot, totalS: 800 }))).toEqual(
        atLimit('chargeC', 228, 233),
      );
      const near = { ...PROFILE, chargeC: 200, capC: 204 };
      // Within charge's own range, but past the cap: the cap is in the way.
      expect(suggestTasteChange(input(['flat'], { profile: near, totalS: 800 }))).toEqual({
        kind: 'none',
        reason: { kind: 'clashes', field: 'chargeC' },
      });
    });

    it('says a change clashes with a curve point, not that it is at its limit', () => {
      const tight = { ...PROFILE, capC: 211 };
      expect(
        suggestTasteChange(input(['roasty'], { profile: tight, developmentShare: 0.1 })),
      ).toEqual({ kind: 'none', reason: { kind: 'clashes', field: 'capC' } });
    });

    it('keeps a hotter BT cap within the roaster’s own limit', () => {
      const capped: ReportFinding = { kind: 'cap-drop', atS: 640, capC: 215, shortS: 20 };
      const tasted = input(['sour'], { findings: [capped], maxTempC: 217 });
      expect(suggestTasteChange(tasted)).toEqual(atLimit('capC', 215, 218));
      expect(suggestTasteChange({ ...tasted, maxTempC: 218 })).toMatchObject({ kind: 'change' });
    });
  });

  it('runs the rules it is given', () => {
    const always: TasteRule = {
      id: 'always',
      suggest: () => ({ kind: 'none', reason: { kind: 'mixed' } }),
    };
    expect(suggestTasteChange(input(['sour']), [always])).toEqual({
      kind: 'none',
      reason: { kind: 'mixed' },
    });
    expect(suggestTasteChange(input(['sour']), [])).toBeUndefined();
  });
});

describe('applyTasteChange', () => {
  it('changes only that value, on a copy', () => {
    const changed = applyTasteChange(PROFILE, { field: 'devTimeS', from: 105, to: 120 });
    expect(changed).toEqual({ ...PROFILE, devTimeS: 120 });
    expect(PROFILE.devTimeS).toBe(105);
  });
});

describe('tasteInput', () => {
  const detail = {
    tasteTags: ['sour'] as TasteTag[],
    mode: 'auto' as const,
    profile: PROFILE,
    fcTimeS: 540,
    dropTimeS: 645,
  };

  it('takes the roaster’s limit when given', () => {
    expect(tasteInput(detail, undefined, { maxTempC: 240 }).maxTempC).toBe(240);
    expect(tasteInput(detail, undefined)).not.toHaveProperty('maxTempC');
  });

  it('reads development from first crack to drop', () => {
    const read = tasteInput(detail, { endS: 645, findings: [stall] });
    expect(read).toEqual({
      tags: new Set(['sour']),
      profile: PROFILE,
      developmentS: 105,
      developmentShare: 105 / 645,
      totalS: 645,
      findings: [stall],
    });
  });

  it('has no profile for a manual roast, or an Auto one without its copy', () => {
    expect(tasteInput({ ...detail, mode: 'manual' }, undefined).profile).toBeUndefined();
    expect(tasteInput({ ...detail, profile: null }, undefined).profile).toBeUndefined();
  });

  it('has no development without first crack, drop, or with drop before it', () => {
    for (const times of [
      { fcTimeS: null, dropTimeS: 645 },
      { fcTimeS: 540, dropTimeS: null },
      { fcTimeS: 540, dropTimeS: 540 },
    ]) {
      const read = tasteInput({ ...detail, ...times }, undefined);
      expect(read.developmentS).toBeUndefined();
      expect(read.developmentShare).toBeUndefined();
    }
  });

  it('reads no tags from a roast from before taste, and the end from drop without a report', () => {
    const read = tasteInput({ ...detail, tasteTags: undefined }, undefined);
    expect(read.tags.size).toBe(0);
    expect(read.totalS).toBe(645);
    expect(read.findings).toEqual([]);
    expect(tasteInput({ ...detail, dropTimeS: null }, undefined).totalS).toBeUndefined();
  });
});
