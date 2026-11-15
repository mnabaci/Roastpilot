import { PROFILE_SCHEMA_VERSION, type AutoProfile } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { needsAttention, type ReportFinding } from './report-types';
import { roastReport } from './roast-report';
import { btIn, savedEvent, savedRoast, samplesFromRor, steadyRor } from './roast-report.harness';

const steady = samplesFromRor(steadyRor, 700);
const kinds = (findings: readonly ReportFinding[] | undefined) => findings?.map((f) => f.kind);

/** A curve profile whose plan is the steady roast itself: dry end, first crack 9:00, drop 11:00. */
const PROFILE: AutoProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'test-curve',
  name: 'Test · Curve',
  needsCalibration: false,
  batchG: 350,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 120,
  capC: 230,
  curve: [0, 60, 90, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660].map((tS) => ({
    tS,
    c: btIn(steady, tS),
  })),
  phases: [{ name: 'Roast', heat: { mode: 'fixed', pct: 60 }, fanPct: 30, next: { on: 'end' } }],
};

describe('roastReport', () => {
  it('reports a steady roast: three phases and nothing to look at', () => {
    const report = roastReport(savedRoast({ samples: steady }));
    expect(report?.endS).toBe(660);
    expect(report?.end).toEqual({ tS: 660, c: btIn(steady, 660) });
    expect(report?.stopped).toBe(false);
    expect(report?.phases.map((p) => p.kind)).toEqual(['drying', 'maillard', 'development']);
    expect(report?.firstCrack).toEqual({ tS: 540, c: btIn(steady, 540) });
    expect(report?.findings).toEqual([]);
    expect(report?.plan).toBeUndefined();
  });

  it('waits for drop or Stop roast, and skips roasts too short or too sparse to measure', () => {
    expect(roastReport(savedRoast({ samples: steady, fcS: null, dropS: null }))).toBeUndefined();
    expect(roastReport(savedRoast({ samples: steady, fcS: null, dropS: 100 }))).toBeUndefined();
    const sparse = samplesFromRor(steadyRor, 700, { everyS: 30 });
    expect(roastReport(savedRoast({ samples: sparse }))).toBeUndefined();
    expect(roastReport(savedRoast({ samples: [] }))).toBeUndefined();
  });

  it('reports up to Stop roast, with no development, for a roast stopped before drop', () => {
    const detail = savedRoast({
      samples: steady,
      fcS: null,
      dropS: null,
      events: [savedEvent('end', 400)],
    });
    const report = roastReport(detail);
    expect(report?.endS).toBe(400);
    expect(report?.stopped).toBe(true);
    expect(report?.phases.map((p) => p.kind)).toEqual(['drying', 'maillard']);
    expect(kinds(report?.findings)).toEqual(['stopped']);
  });

  it('asks for first crack when it dropped without one', () => {
    const report = roastReport(savedRoast({ samples: steady, fcS: null }));
    expect(kinds(report?.findings)).toEqual(['no-first-crack']);
    expect(report?.phases.map((p) => p.kind)).toEqual(['drying', 'maillard']);
  });

  it('finds a crash and a flick after first crack', () => {
    const rough = samplesFromRor(
      (t) => (t <= 560 ? steadyRor(t) : t <= 590 ? 1 : t <= 620 ? 1 : 4),
      700,
    );
    const report = roastReport(savedRoast({ samples: rough }));
    expect(kinds(report?.findings)).toEqual(['crash', 'flick']);
  });

  it('finds a stall before first crack, with whether the stall guard tripped', () => {
    const stalled = samplesFromRor((t) => (t >= 400 && t < 460 ? 1 : steadyRor(t)), 700);
    const report = roastReport(
      savedRoast({
        samples: stalled,
        events: [
          savedEvent('stall-guard', 410, 'tripped'),
          savedEvent('stall-guard', 470, 'cleared'),
        ],
      }),
    );
    expect(report?.findings).toContainEqual(
      expect.objectContaining({ kind: 'stall', guarded: true }),
    );
  });

  it('notes the stall guard stepping in when no stall followed', () => {
    const report = roastReport(
      savedRoast({
        samples: steady,
        events: [
          savedEvent('stall-guard', 410, 'tripped'),
          savedEvent('stall-guard', 420, 'cleared'),
          savedEvent('stall-guard', 450, 'tripped'),
        ],
      }),
    );
    expect(report?.findings).toEqual([{ kind: 'stall-guard', atS: 410, times: 2 }]);
  });

  it('notes a development much shorter or longer than most roasts take', () => {
    expect(roastReport(savedRoast({ samples: steady, fcS: 620 }))?.findings).toEqual([
      { kind: 'development-share', share: 40 / 660, side: 'short' },
    ]);
    expect(kinds(roastReport(savedRoast({ samples: steady, fcS: 450 }))?.findings)).toEqual([
      'development-share',
    ]);
  });

  it('judges development as its whole percentage shows: 9.6 % reads 10 %, not short', () => {
    // 64 s of 666 is 9.6 %.
    expect(roastReport(savedRoast({ samples: steady, fcS: 602, dropS: 666 }))?.findings).toEqual(
      [],
    );
    // 62 s of 666 is 9.3 %: shown as 9 %, short.
    expect(
      kinds(roastReport(savedRoast({ samples: steady, fcS: 604, dropS: 666 }))?.findings),
    ).toEqual(['development-share']);
  });

  it('flags missing readings, first, as something to look at', () => {
    const gappy = samplesFromRor(steadyRor, 700, { skip: (t) => t > 300 && t < 330 });
    const report = roastReport(savedRoast({ samples: gappy, fcS: 620 }));
    expect(kinds(report?.findings)).toEqual(['gap', 'development-share']);
    expect(report?.findings[0]).toEqual({ kind: 'gap', fromS: 300, toS: 330 });
  });

  it('puts what needs attention before notes, each in time order', () => {
    const stalled = samplesFromRor((t) => (t >= 400 && t < 460 ? 1 : steadyRor(t)), 700);
    const report = roastReport(savedRoast({ samples: stalled, fcS: 620 }));
    const findings = report?.findings ?? [];
    expect(kinds(findings)).toEqual(['stall', 'development-share']);
    expect(findings.map(needsAttention)).toEqual([true, false]);
  });

  describe('an Auto roast', () => {
    const auto = (over: Partial<Parameters<typeof savedRoast>[0]> = {}) =>
      savedRoast({ samples: steady, mode: 'auto', profile: PROFILE, ...over });

    it('compares dry end, first crack, drop and development with the plan', () => {
      const plan = roastReport(auto())?.plan;
      expect(plan?.firstCrack.plan?.tS).toBe(540);
      expect(plan?.firstCrack.actual?.tS).toBe(540);
      expect(plan?.drop.plan?.tS).toBe(660);
      expect(plan?.developmentS).toEqual({ actual: 120, plan: 120 });
      // The plan is this roast, so dry end lands within a few seconds of where the plan has it.
      const planned = plan?.dryEnd.plan?.tS ?? Number.NaN;
      const actual = plan?.dryEnd.actual?.tS ?? Number.NaN;
      expect(Math.abs(planned - actual)).toBeLessThan(5);
      expect(Math.abs(plan?.furthest?.byC ?? Infinity)).toBeLessThan(2);
    });

    it('notes BT running 5 °C or more off the plan, and where', () => {
      const hot = samplesFromRor((t) => steadyRor(t) + (t > 120 && t < 240 ? 4 : 0), 700);
      const report = roastReport(auto({ samples: hot }));
      const off = report?.findings.find((f) => f.kind === 'off-plan');
      expect(off).toMatchObject({ kind: 'off-plan' });
      if (off?.kind === 'off-plan') expect(off.byC).toBeGreaterThanOrEqual(5);
    });

    it('stops the comparison where you took over', () => {
      const hot = samplesFromRor((t) => steadyRor(t) + (t > 400 ? 10 : 0), 700);
      const report = roastReport(
        auto({ samples: hot, events: [savedEvent('mode', 380, 'manual')] }),
      );
      expect(report?.plan?.untilS).toBe(380);
      expect(report?.plan?.drop.actual).toBeUndefined();
      expect(kinds(report?.findings)).toContain('took-over');
      expect(kinds(report?.findings)).not.toContain('off-plan');
    });

    it('notes a drop at the BT cap that cut development short', () => {
      const capC = btIn(steady, 600);
      const report = roastReport(auto({ dropS: 600, profile: { ...PROFILE, capC } }));
      expect(report?.findings).toContainEqual({
        kind: 'cap-drop',
        atS: 600,
        capC,
        shortS: 60,
      });
    });

    it('has no plan on a Manual roast, or an Auto one without its profile', () => {
      expect(roastReport(savedRoast({ samples: steady, profile: PROFILE }))?.plan).toBeUndefined();
      expect(roastReport(auto({ profile: null }))?.plan).toBeUndefined();
    });
  });
});
