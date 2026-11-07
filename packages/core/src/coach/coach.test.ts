import {
  READY_ROAST,
  type AutoProfile,
  type CoachAdvice,
  type CoachStatus,
  type Reading,
  type RoastState,
} from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { ManualClock } from '../clock';
import { Coach } from './coach';
import { COACH_PROFILE, COACH_TUNING } from './coach.harness';
import type { CoachRule } from './coach-rule';
import { dropSoonRule } from './drop-soon-rule';
import { firstCrackSoonRule } from './first-crack-soon-rule';
import { autoSettingRule } from './setting-rule';

/** BT of the test roast: down to 95 °C at 1:00, 150 °C at 5:00 (Maillard), then 10 °C/min. */
function btAt(s: number): number {
  if (s <= 60) return 180 - (85 * s) / 60;
  if (s <= 300) return 95 + ((s - 60) * 55) / 240;
  return 150 + (s - 300) / 6;
}

const ROASTING: RoastState = {
  ...READY_ROAST,
  phase: 'roasting',
  chargedAtMs: 0,
  startPressedAtMs: 0,
};

/** The rules as main registers them. */
const COACH_RULES: readonly CoachRule[] = [autoSettingRule, firstCrackSoonRule, dropSoonRule];

function setup({
  profile = COACH_PROFILE,
  rules = COACH_RULES,
}: { profile?: AutoProfile; rules?: readonly CoachRule[] } = {}) {
  const clock = new ManualClock(0);
  const world = {
    roast: ROASTING,
    wanted: true,
    locked: false,
    expectedC: 196 as number | undefined,
    outputs: { heater: 0, fan: 30 },
  };
  const readings: Reading[] = [];
  const statuses: CoachStatus[] = [];
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  const coach = new Coach({
    clock,
    roast: () => world.roast,
    readings: () => readings,
    profile: () => profile,
    tuning: () => COACH_TUNING,
    wanted: () => world.wanted,
    heaterLocked: () => world.locked,
    expectedFirstCrackC: () => world.expectedC,
    round: (_channel, value) => Math.round(value),
    rules,
    onChange: (status) => statuses.push(status),
    logger,
  });
  /** The readings from `fromS` to `toS`, one a second, with the outputs as set. */
  const feed = (fromS: number, toS = fromS) => {
    for (let s = fromS; s <= toS; s++) {
      clock.advance(s * 1_000 - clock.now());
      const sinceChargeS = s - (world.roast.chargedAtMs ?? 0) / 1_000;
      const reading = { atMs: s * 1_000, values: { bt: btAt(sinceChargeS), ...world.outputs } };
      readings.push(reading);
      coach.onReading(reading);
    }
  };
  const advice = (): CoachAdvice | null => coach.status.advice;
  /** Readings up to `toS` while the coach is off, then it comes on. */
  const caughtUpTo = (toS: number) => {
    world.wanted = false;
    feed(0, toS);
    world.wanted = true;
  };
  const logged = (event: string) => logger.info.mock.calls.filter(([name]) => name === event);
  return { coach, world, feed, advice, statuses, logger, logged, caughtUpTo };
}

describe('Coach', () => {
  describe('suggests what Auto would set', () => {
    it("from charge: the soak's heater, from what you set", () => {
      const { world, feed, advice } = setup();
      world.outputs = { heater: 70, fan: 30 };
      feed(0);
      expect(advice()).toEqual({
        kind: 'setting',
        id: 1,
        heater: { from: 70, to: 0 },
        reason: 'Soak from 180 °C',
      });
    });

    it('says nothing while you are where Auto would be', () => {
      const { feed, advice } = setup();
      feed(0, 30);
      expect(advice()).toBeNull();
    });

    it('names the phase that has just begun, and changes the card without waiting', () => {
      const { world, feed, advice, caughtUpTo } = setup();
      caughtUpTo(298);
      world.outputs = { heater: 80, fan: 30 };
      feed(299, 300);
      expect(advice()).toBeNull();
      // BT settles over three readings, so the phase begins a reading after BT reaches 150 °C.
      feed(301);
      expect(advice()).toMatchObject({ fan: { from: 30, to: 50 }, reason: 'Maillard from 150 °C' });
    });

    it('catches up mid-roast into the phase the roast has reached, from your heater', () => {
      const { world, feed, advice, caughtUpTo, logged } = setup();
      caughtUpTo(359);
      world.outputs = { heater: 30, fan: 50 };
      feed(360);
      expect(logged('coach.started')[0]?.[1]).toEqual({
        profileId: 'light-steps',
        phase: 'Maillard',
      });
      // The curve phase starts from your 30 % and moves 5 % per 10 s (ADR 0016): 10 points in 20 s.
      feed(361, 377);
      expect(advice()).toBeNull();
      feed(378, 382);
      expect(advice()).toMatchObject({ heater: { from: 30, to: 40 } });
      const shown = advice();
      expect(shown?.kind === 'setting' ? shown.reason : '').toMatch(/target, RoR steady$/);
    });

    it('gives at most one new suggestion every 15 s', () => {
      const { world, feed, advice, caughtUpTo } = setup();
      caughtUpTo(359);
      world.outputs = { heater: 30, fan: 50 };
      const posted: number[] = [];
      for (let s = 360; s <= 440; s++) {
        const before = advice()?.id;
        feed(s);
        if (advice() && advice()?.id !== before) posted.push(s);
      }
      expect(posted.length).toBeGreaterThan(2);
      posted.slice(1).forEach((s, i) => {
        expect(s - (posted[i] ?? 0)).toBeGreaterThanOrEqual(15);
      });
    });
  });

  describe('starts again from your heater', () => {
    const suggesting = () => {
      const kit = setup();
      kit.caughtUpTo(359);
      kit.world.outputs = { heater: 30, fan: 50 };
      kit.feed(360, 395);
      expect(kit.advice()).toMatchObject({ kind: 'setting', heater: { from: 30 } });
      return kit;
    };

    it('when you set it, so the suggestion is a step from there', () => {
      const { coach, world, feed, advice } = suggesting();
      coach.outputRequested('heater', 20);
      feed(396);
      expect(advice()).toBeNull();
      world.outputs = { heater: 20, fan: 50 };
      feed(397, 410);
      expect(advice()).toBeNull();
      feed(411, 420);
      expect(advice()).toMatchObject({ heater: { from: 20, to: 30 } });
    });

    it('when the roaster reports a heater you did not set', () => {
      const { world, feed, advice } = suggesting();
      world.outputs = { heater: 20, fan: 50 };
      feed(396);
      expect(advice()).toBeNull();
    });

    it('not when you set the fan', () => {
      const { coach, feed, advice } = suggesting();
      coach.outputRequested('fan', 50);
      coach.outputRequested('drum', 1);
      feed(396);
      expect(advice()).toMatchObject({ heater: { from: 30 } });
    });
  });

  describe('is quiet', () => {
    it.each([
      ['in Preheat', { roast: { ...READY_ROAST, phase: 'preheat' } }],
      ['in Cooling', { roast: { ...ROASTING, phase: 'cooling' } }],
      ['in Auto, or with the setting off', { wanted: false }],
      ['disconnected or locked by a safety stop', { locked: true }],
    ] as const)('%s', (_name, change) => {
      const { world, feed, advice } = setup();
      Object.assign(world, change, { outputs: { heater: 70, fan: 30 } });
      feed(0, 5);
      expect(advice()).toBeNull();
    });

    it.each([
      ['Drop', { roast: { ...ROASTING, phase: 'cooling' } }],
      ['a switch to Auto, or the setting off', { wanted: false }],
      ['a disconnect or a safety stop', { locked: true }],
    ] as const)('at once after %s', (_name, change) => {
      const { coach, world, feed, advice, statuses, logged } = setup();
      world.outputs = { heater: 70, fan: 30 };
      feed(0);
      expect(advice()).not.toBeNull();
      Object.assign(world, change);
      coach.sync();
      expect(advice()).toBeNull();
      expect(statuses.at(-1)?.advice).toBeNull();
      expect(logged('coach.stopped')).toHaveLength(1);
    });

    it('at once on a safe stop, before the lock is in place', () => {
      const { coach, world, feed, advice } = setup();
      world.outputs = { heater: 70, fan: 30 };
      feed(0);
      coach.stop();
      expect(advice()).toBeNull();
      world.locked = true;
      feed(1, 5);
      expect(advice()).toBeNull();
    });

    it('and keeps what you dismissed when it comes back in the same roast', () => {
      const { coach, world, feed, advice } = setup({ rules: [firstCrackSoonRule] });
      feed(0, 520);
      const id = advice()?.id ?? 0;
      coach.dismiss(id);
      world.locked = true;
      feed(521);
      world.locked = false;
      feed(522, 530);
      expect(advice()).toBeNull();
    });

    it('when a rule fails, and says so in the log', () => {
      const failing: CoachRule = {
        id: 'failing',
        advise: () => {
          throw new Error('bug');
        },
      };
      const { feed, advice, logger } = setup({ rules: [failing] });
      expect(() => {
        feed(0);
      }).not.toThrow();
      expect(advice()).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('coach.tick-failed', expect.anything());
    });
  });

  describe('heads-ups', () => {
    it('first crack within 60 s of the expected, counting down in 5 s', () => {
      const { feed, advice } = setup({ rules: [firstCrackSoonRule, dropSoonRule] });
      // BT reaches 196 °C at 576 s.
      feed(0, 515);
      expect(advice()).toBeNull();
      feed(516);
      expect(advice()).toEqual({ kind: 'first-crack-soon', id: 1, inS: 60 });
      feed(517, 548);
      expect(advice()).toEqual({ kind: 'first-crack-soon', id: 1, inS: 30 });
    });

    it('none without an expected first crack', () => {
      const { world, feed, advice } = setup({ rules: [firstCrackSoonRule] });
      world.expectedC = undefined;
      feed(0, 560);
      expect(advice()).toBeNull();
    });

    it('only when no setting is suggested', () => {
      const { coach, world, feed, advice, caughtUpTo } = setup();
      caughtUpTo(519);
      world.outputs = { heater: 0, fan: 0 };
      feed(520);
      expect(advice()).toMatchObject({ kind: 'setting' });
      coach.dismiss(advice()?.id ?? 0);
      feed(521);
      expect(advice()).toMatchObject({ kind: 'first-crack-soon' });
    });

    it('drop 30 s before the development time', () => {
      const { world, feed, advice } = setup({ rules: [dropSoonRule] });
      feed(0, 579);
      world.roast = { ...ROASTING, phase: 'development', firstCrackAtMs: 580_000 };
      feed(580, 639);
      expect(advice()).toBeNull();
      feed(640);
      expect(advice()).toEqual({ kind: 'drop-soon', id: 1, inS: 30, devTimeS: 90 });
    });

    it('come back for the next roast after a dismiss', () => {
      const { coach, world, feed, advice } = setup({ rules: [firstCrackSoonRule] });
      feed(0, 520);
      coach.dismiss(advice()?.id ?? 0);
      feed(521);
      expect(advice()).toBeNull();
      world.roast = { ...ROASTING, chargedAtMs: 1_000_000 };
      feed(1_000, 1_520);
      expect(advice()).toMatchObject({ kind: 'first-crack-soon' });
    });
  });

  describe('Apply and Dismiss', () => {
    const suggesting = () => {
      const kit = setup();
      kit.world.outputs = { heater: 70, fan: 30 };
      kit.feed(0);
      return kit;
    };

    it('Apply takes the card for main to set', () => {
      const { coach, advice, statuses } = suggesting();
      const id = advice()?.id ?? 0;
      expect(coach.claim(id)).toEqual({
        ok: true,
        value: { kind: 'setting', id, heater: { from: 70, to: 0 }, reason: 'Soak from 180 °C' },
      });
      expect(advice()).toBeNull();
      expect(statuses.at(-1)?.advice).toBeNull();
    });

    it('Apply refuses a card that changed or went', () => {
      const { coach, advice } = suggesting();
      const id = advice()?.id ?? 0;
      expect(coach.claim(id + 1)).toEqual({ ok: false, error: { kind: 'stale' } });
      coach.claim(id);
      expect(coach.claim(id)).toEqual({ ok: false, error: { kind: 'stale' } });
    });

    it('Apply refuses once the roast no longer allows it', () => {
      const { coach, world, advice } = suggesting();
      world.locked = true;
      expect(coach.claim(advice()?.id ?? 0)).toEqual({ ok: false, error: { kind: 'not-now' } });
    });

    it('Dismiss hides the card and says so in the log', () => {
      const { coach, feed, advice, logged } = suggesting();
      const id = advice()?.id ?? 0;
      coach.dismiss(id);
      expect(advice()).toBeNull();
      expect(logged('coach.dismissed')).toEqual([['coach.dismissed', { kind: 'setting', id }]]);
      feed(1, 20);
      expect(advice()).toBeNull();
    });

    it('Dismiss leaves a card that has changed', () => {
      const { coach, advice, logged } = suggesting();
      coach.dismiss((advice()?.id ?? 0) + 1);
      expect(advice()).not.toBeNull();
      expect(logged('coach.dismissed')).toHaveLength(0);
    });
  });

  it('notes a profile that needs calibration, only while it says something', () => {
    const { world, feed, coach } = setup({
      profile: { ...COACH_PROFILE, needsCalibration: true },
    });
    feed(0);
    expect(coach.status.needsCalibration).toBeNull();
    world.outputs = { heater: 70, fan: 30 };
    feed(1);
    expect(coach.status).toMatchObject({ needsCalibration: 'Light · Steps' });
  });

  it('tells the window only what changed, and logs each new suggestion', () => {
    const { world, feed, statuses, logged } = setup();
    world.outputs = { heater: 70, fan: 30 };
    feed(0, 10);
    expect(statuses).toHaveLength(1);
    expect(logged('coach.suggested')).toEqual([
      [
        'coach.suggested',
        { kind: 'setting', id: 1, heater: { from: 70, to: 0 }, reason: 'Soak from 180 °C' },
      ],
    ]);
  });
});
