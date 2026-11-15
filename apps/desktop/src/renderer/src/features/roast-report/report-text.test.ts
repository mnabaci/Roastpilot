import type { PlanCheck, RoastReport } from '@roastpilot/core';
import { describe, expect, it } from 'vitest';
import {
  findingSpan,
  findingText,
  phaseNote,
  phaseParts,
  planRows,
  reportSummary,
  wholePercents,
} from './report-text';

const REPORT: RoastReport = {
  endS: 660,
  end: { tS: 660, c: 210 },
  stopped: false,
  phases: [
    { kind: 'drying', fromS: 0, toS: 264, share: 264 / 660 },
    { kind: 'maillard', fromS: 264, toS: 540, share: 276 / 660 },
    { kind: 'development', fromS: 540, toS: 660, share: 120 / 660 },
  ],
  turningPoint: { tS: 60, c: 90 },
  dryEnd: { tS: 264, c: 150.2, estimated: false },
  firstCrack: { tS: 540, c: 201.3 },
  plan: undefined,
  findings: [],
};

describe('wholePercents', () => {
  it('rounds shares to whole percentages that add up to 100', () => {
    expect(wholePercents([1 / 3, 1 / 3, 1 / 3])).toEqual([34, 33, 33]);
    expect(wholePercents([0.405, 0.405, 0.19])).toEqual([41, 40, 19]);
    expect(wholePercents([])).toEqual([]);
  });
});

describe('phaseParts', () => {
  it('gives each phase its length and share, strongest fill last', () => {
    expect(phaseParts(REPORT, 'c').map((p) => [p.label, p.detail, p.tone])).toEqual([
      ['Drying', '4:24 · 40 %', 'low'],
      ['Maillard', '4:36 · 42 %', 'mid'],
      ['Development', '2:00 · 18 %', 'high'],
    ]);
  });

  it('reads the stretches an estimated dry end bounds as about', () => {
    const parts = phaseParts({ ...REPORT, dryEnd: { tS: 264, c: 150.2, estimated: true } }, 'c');
    expect(parts.map((p) => p.detail)).toEqual(['≈ 4:24 · 40 %', '≈ 4:36 · 42 %', '2:00 · 18 %']);
    expect(parts[0]?.spokenDetail).toBe('about 4:24, 40 %');
  });
});

describe('phaseParts › where each phase ended', () => {
  it('gives BT at dry end, first crack and drop, in the screen’s unit', () => {
    const report = { ...REPORT, end: { tS: 660, c: 210.4 } };
    expect(phaseParts(report, 'c').map((p) => p.end)).toEqual([
      'to 150.2 °C',
      'to 201.3 °C',
      'to 210.4 °C',
    ]);
    expect(phaseParts(report, 'f').map((p) => p.end)).toEqual([
      'to 302 °F',
      'to 394 °F',
      'to 411 °F',
    ]);
  });

  it('runs Maillard to drop with no first crack, and leaves out an end with no reading', () => {
    const report: RoastReport = {
      ...REPORT,
      phases: [
        { kind: 'drying', fromS: 0, toS: 264, share: 0.4 },
        { kind: 'maillard', fromS: 264, toS: 660, share: 0.6 },
      ],
      firstCrack: undefined,
      end: undefined,
    };
    expect(phaseParts(report, 'c').map((p) => p.end)).toEqual(['to 150.2 °C', undefined]);
  });
});

describe('phaseNote', () => {
  it('says where an unmarked dry end was taken, and when drying can’t be split out', () => {
    const estimated = { ...REPORT, dryEnd: { tS: 264, c: 150.2, estimated: true } };
    expect(phaseNote(estimated)).toBe(
      'No dry end marked · taken at 4:24, where BT first reached the dry-end temperature',
    );
    expect(phaseNote(REPORT)).toBeUndefined();
    expect(phaseNote({ ...REPORT, dryEnd: undefined })).toMatch(/never reached dry end/);
  });
});

describe('findingText', () => {
  it('says RoR in the unit, as a difference: ×1.8 with no + 32', () => {
    const crash = { kind: 'crash', atS: 540, fromRor: 9, toRor: 2 } as const;
    expect(findingText(crash, 'c').detail).toMatch(
      /^Fell from 9\.0 to 2\.0 °C\/min within a minute of 9:00/,
    );
    expect(findingText(crash, 'f').detail).toMatch(/^Fell from 16\.2 to 3\.6 °F\/min/);
  });

  it('says whether Auto’s stall guard added heat during a stall', () => {
    const stall = { kind: 'stall', atS: 682, durationS: 73, minRor: 2.06, guarded: true } as const;
    expect(findingText(stall, 'c')).toEqual({
      title: 'RoR stalled before first crack',
      detail: 'Down to 2.1 °C/min for 1:13 from 11:22 · Auto’s stall guard added heat',
    });
  });

  it('counts the stall guard’s trips', () => {
    expect(findingText({ kind: 'stall-guard', atS: 410, times: 1 }, 'c').detail).toBe(
      'At 6:50 · RoR picked up, no stall followed',
    );
    expect(findingText({ kind: 'stall-guard', atS: 410, times: 2 }, 'c').detail).toBe(
      '2 times, first at 6:50 · no stall followed',
    );
  });

  it('says how far off the plan BT ran, and which way, whole', () => {
    expect(findingText({ kind: 'off-plan', atS: 261, byC: -9.04 }, 'c').title).toBe(
      'BT ran up to 9 °C under the plan',
    );
    expect(findingText({ kind: 'off-plan', atS: 261, byC: 5 }, 'f').title).toBe(
      'BT ran up to 9 °F over the plan',
    );
  });

  it('gives development’s share whole, as the Development card does', () => {
    const short = { kind: 'development-share', share: 0.0876, side: 'short' } as const;
    expect(findingText(short, 'c')).toEqual({
      title: 'Short development',
      detail: '9 % of the roast came after first crack · it can taste sour or grassy',
    });
  });

  it('has words for every other kind', () => {
    const unit = 'c';
    expect(findingText({ kind: 'gap', fromS: 300, toS: 330 }, unit).detail).toBe(
      'No BT from 5:00 to 5:30 · RoR isn’t checked across it',
    );
    expect(findingText({ kind: 'took-over', atS: 380 }, unit).title).toBe('You took over at 6:20');
    expect(findingText({ kind: 'stopped', atS: 400 }, unit).title).toBe('Stopped before drop');
    expect(findingText({ kind: 'no-first-crack' }, unit).title).toBe('No first crack marked');
    expect(findingText({ kind: 'cap-drop', atS: 600, capC: 228, shortS: 60 }, unit).detail).toBe(
      'Reached 228.0 °C at 10:00, 1:00 before the planned development ended',
    );
    expect(findingText({ kind: 'flick', atS: 620, fromRor: 3, toRor: 5 }, unit).title).toBe(
      'RoR flicked up before drop',
    );
  });
});

describe('planRows', () => {
  const plan: PlanCheck = {
    dryEnd: { actual: { tS: 270, c: 150.4 }, plan: { tS: 264, c: 150 } },
    firstCrack: { actual: { tS: 560, c: 202 }, plan: { tS: 540, c: 201.3 } },
    drop: { actual: { tS: 660, c: 210 }, plan: { tS: 660, c: 211 } },
    developmentS: { actual: 100, plan: 120 },
    furthest: { atS: 300, byC: -3 },
    untilS: 660,
  };

  it('puts this roast beside the plan, this roast minus the plan', () => {
    expect(planRows(plan, 'c')).toEqual([
      {
        label: 'Dry end',
        own: '4:30 · 150.4 °C',
        other: '4:24 · 150.0 °C',
        diff: '+0:06 · +0.4 °C',
      },
      {
        label: 'First crack',
        own: '9:20 · 202.0 °C',
        other: '9:00 · 201.3 °C',
        diff: '+0:20 · +0.7 °C',
      },
      { label: 'Development', own: '1:40', other: '2:00', diff: '−0:20' },
      { label: 'Drop', own: '11:00 · 210.0 °C', other: '11:00 · 211.0 °C', diff: '0:00 · −1.0 °C' },
    ]);
  });

  it('leaves this roast’s side blank after you took over', () => {
    const rows = planRows(
      {
        ...plan,
        drop: { actual: undefined, plan: plan.drop.plan },
        developmentS: { actual: undefined, plan: 120 },
      },
      'c',
    );
    expect(rows[2]).toEqual({
      label: 'Development',
      own: undefined,
      other: '2:00',
      diff: undefined,
    });
    expect(rows[3]?.own).toBeUndefined();
    expect(rows[3]?.diff).toBeUndefined();
  });
});

describe('reportSummary', () => {
  it('sums up the phases, then nothing stood out', () => {
    expect(reportSummary(REPORT, 'c')).toBe(
      'Drying 40 % · Maillard 42 % · Development 18 % · Nothing stood out',
    );
  });

  it('leads with the first thing worth a look and how many more', () => {
    const report: RoastReport = {
      ...REPORT,
      findings: [
        { kind: 'gap', fromS: 300, toS: 330 },
        { kind: 'stall', atS: 400, durationS: 40, minRor: 2, guarded: false },
        { kind: 'development-share', share: 0.08, side: 'short' },
      ],
    };
    expect(reportSummary(report, 'c')).toMatch(/· Readings missing \+ 1 more$/);
  });

  it('counts notes when nothing needs a look', () => {
    const report: RoastReport = { ...REPORT, findings: [{ kind: 'took-over', atS: 300 }] };
    expect(reportSummary(report, 'c')).toMatch(/· 1 note$/);
  });
});

describe('findingSpan', () => {
  it('picks out where each finding happened, a moment where it has no length', () => {
    expect(findingSpan({ kind: 'crash', atS: 560, fromRor: 9, toRor: 2 }, REPORT)).toEqual({
      fromS: 560,
      toS: 620,
    });
    expect(findingSpan({ kind: 'crash', atS: 630, fromRor: 9, toRor: 2 }, REPORT)?.toS).toBe(660);
    expect(
      findingSpan({ kind: 'stall', atS: 400, durationS: 45, minRor: 2, guarded: false }, REPORT),
    ).toEqual({ fromS: 400, toS: 445 });
    expect(findingSpan({ kind: 'took-over', atS: 380 }, REPORT)).toEqual({ fromS: 380, toS: 660 });
    expect(findingSpan({ kind: 'development-share', share: 0.08, side: 'short' }, REPORT)).toEqual({
      fromS: 540,
      toS: 660,
    });
    expect(findingSpan({ kind: 'off-plan', atS: 261, byC: 6 }, REPORT)).toEqual({
      fromS: 261,
      toS: 261,
    });
    expect(findingSpan({ kind: 'no-first-crack' }, REPORT)).toBeUndefined();
  });
});
