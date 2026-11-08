import { silentLogger } from '@roastpilot/core';
import { err, ok, type CoachSetting, type DriverError, type Result } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { coachActions } from './coach-apply';

const BOTH: CoachSetting = {
  kind: 'setting',
  id: 4,
  heater: { from: 65, to: 75 },
  fan: { from: 50, to: 40 },
  reason: 'Maillard from 150 °C',
};

function setup(
  claimed: ReturnType<typeof ok<CoachSetting>> | ReturnType<typeof err> = ok(BOTH),
  refuse?: { channel: string; error: DriverError },
  /** What happens while an output is being set: Drop, a switch to Auto. */
  whileSetting: (world: { allowed: boolean }) => void = () => undefined,
) {
  const world = { allowed: true };
  const sent: [string, number][] = [];
  const noted: [string, string | undefined][] = [];
  const logger = { ...silentLogger, info: vi.fn(), warn: vi.fn() };
  const coach = {
    claim: vi.fn(() => claimed as Result<CoachSetting, { kind: 'stale' } | { kind: 'not-now' }>),
    canApply: () => world.allowed,
    dismiss: vi.fn(),
  };
  const actions = coachActions({
    coach,
    setOutput: (channel, value) => {
      if (refuse?.channel === channel) return Promise.resolve(err(refuse.error));
      sent.push([channel, value]);
      whileSetting(world);
      return Promise.resolve(ok(undefined));
    },
    roast: { note: (kind, detail) => noted.push([kind, detail]) },
    logger,
  });
  return { actions, coach, sent, noted, logger };
}

describe('coach Apply', () => {
  it("sets heater then fan through the sliders' path, and records what changed", async () => {
    const { actions, coach, sent, noted, logger } = setup();
    expect(await actions.apply(4)).toEqual(ok(undefined));
    expect(coach.claim).toHaveBeenCalledWith(4);
    expect(sent).toEqual([
      ['heater', 75],
      ['fan', 40],
    ]);
    expect(noted).toEqual([['coach-applied', 'heater 65→75, fan 50→40']]);
    expect(logger.info).toHaveBeenCalledWith('coach.applied', {
      id: 4,
      heater: BOTH.heater,
      fan: BOTH.fan,
    });
  });

  it('sets nothing for a card that changed, or once the roast no longer allows it', async () => {
    for (const error of [{ kind: 'stale' }, { kind: 'not-now' }] as const) {
      const { actions, sent, noted } = setup(err(error));
      expect(await actions.apply(4)).toEqual(err(error));
      expect(sent).toEqual([]);
      expect(noted).toEqual([]);
    }
  });

  it('stops at an output the roaster refuses, and records only what was set', async () => {
    const refused: DriverError = { kind: 'safety-locked', channel: 'heater' };
    const { actions, sent, noted, logger } = setup(ok(BOTH), { channel: 'heater', error: refused });
    expect(await actions.apply(4)).toEqual(err(refused));
    expect(sent).toEqual([]);
    expect(noted).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith('coach.apply-failed', { id: 4, error: refused });
  });

  it('keeps the heater it set when the fan is refused', async () => {
    const refused: DriverError = { kind: 'no-reply', command: 'FAN' };
    const { actions, sent, noted } = setup(ok(BOTH), { channel: 'fan', error: refused });
    expect(await actions.apply(4)).toEqual(err(refused));
    expect(sent).toEqual([['heater', 75]]);
    expect(noted).toEqual([['coach-applied', 'heater 65→75']]);
  });

  it('sets no more once the roast stops allowing it while the heater is set (Drop)', async () => {
    const { actions, sent, noted } = setup(ok(BOTH), undefined, (world) => {
      world.allowed = false;
    });
    expect(await actions.apply(4)).toEqual(err({ kind: 'not-now' }));
    expect(sent).toEqual([['heater', 75]]);
    expect(noted).toEqual([['coach-applied', 'heater 65→75']]);
  });

  it('Dismiss hands the id to the coach', () => {
    const { actions, coach } = setup();
    actions.dismiss(9);
    expect(coach.dismiss).toHaveBeenCalledWith(9);
  });
});
