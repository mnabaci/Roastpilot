import { describe, expect, it } from 'vitest';
import { simulateAutoRoast } from './auto-simulation.harness';
import { SKYWALKER_PROFILES, SKYWALKER_TUNING } from './skywalker-profiles';

const STYLES = [SKYWALKER_PROFILES['light-steps'], SKYWALKER_PROFILES['light-curve']];
const tuning = SKYWALKER_TUNING;

describe.each(STYLES)('$name on the simulator', (profile) => {
  it('roasts from preheat to auto drop with no stop and no safety trip', async () => {
    const roast = await simulateAutoRoast({ profile, tuning, firstCrackAtC: 191 });
    expect(roast.reachedAddBeans).toBe(true);
    expect(roast.roastEnded).toBe(true);
    expect(roast.stopped).toBe(false);
    expect(roast.safety).toEqual([]);
    expect(roast.failures).toEqual([]);
    expect(roast.finalState.phase).toBe('cooling');
  });

  it('charges near charge temperature, with the heater already at 0', async () => {
    const roast = await simulateAutoRoast({ profile, tuning, firstCrackAtC: 191 });
    expect(roast.btAtCharge).toBeGreaterThan(profile.chargeC - 3);
    expect(roast.btAtCharge).toBeLessThan(profile.chargeC + 3);
    expect(roast.rows[0]?.heater).toBe(0);
  });

  it('keeps the heater at 0 through the soak, then heats', async () => {
    const { rows } = await simulateAutoRoast({ profile, tuning, firstCrackAtC: 191 });
    expect(rows.filter((row) => row.tS < 60).every((row) => row.heater === 0)).toBe(true);
    expect(rows.find((row) => row.tS > 65)?.heater).toBeGreaterThan(0);
  });

  it('follows the soak time setting', async () => {
    const { rows } = await simulateAutoRoast({ profile, tuning, soakS: 90, firstCrackAtC: 191 });
    expect(rows.filter((row) => row.tS < 90).every((row) => row.heater === 0)).toBe(true);
    expect(rows.find((row) => row.tS > 95)?.heater).toBeGreaterThan(0);
  });

  it('runs every phase, in order, and marks dry end once', async () => {
    const { events } = await simulateAutoRoast({ profile, tuning, firstCrackAtC: 191 });
    const phases = events.flatMap((event) => (event.kind === 'phase' ? [event.name] : []));
    expect(phases).toEqual(profile.phases.map((phase) => phase.name));
    expect(events.filter((event) => event.kind === 'dry-end')).toHaveLength(1);
  });

  it('drops at the development time after the first-crack tap', async () => {
    const { finalState } = await simulateAutoRoast({ profile, tuning, firstCrackAtC: 191 });
    const { firstCrackAtMs, droppedAtMs } = finalState;
    expect(firstCrackAtMs).not.toBeNull();
    const devS = ((droppedAtMs ?? 0) - (firstCrackAtMs ?? 0)) / 1_000;
    expect(devS).toBeGreaterThanOrEqual(profile.devTimeS);
    expect(devS).toBeLessThan(profile.devTimeS + 3);
  });

  it('with no tap, drops at the BT cap', async () => {
    const roast = await simulateAutoRoast({ profile, tuning });
    expect(roast.finalState.phase).toBe('cooling');
    expect(roast.finalState.firstCrackAtMs).toBeNull();
    const dropBt = roast.finalState.events.find((event) => event.kind === 'drop')?.bt;
    expect(dropBt).toBeGreaterThanOrEqual(profile.capC);
    expect(dropBt).toBeLessThan(profile.capC + 1);
  });

  it('only ever sends the heater and fan in the roaster’s 5% steps', async () => {
    const { rows } = await simulateAutoRoast({ profile, tuning, firstCrackAtC: 191 });
    expect(rows.every((row) => row.heater % 5 === 0 && row.fan % 5 === 0)).toBe(true);
  });

  it('copes with a cold room without a safety stop', async () => {
    const roast = await simulateAutoRoast({ profile, tuning, firstCrackAtC: 191, ambientC: 5 });
    expect(roast.roastEnded).toBe(true);
    expect(roast.safety.filter((event) => event.kind === 'tripped')).toEqual([]);
  });
});

describe('Light · Steps', () => {
  const profile = SKYWALKER_PROFILES['light-steps'];

  it('stays within 30% above and 20% below its estimate', async () => {
    const { rows } = await simulateAutoRoast({ profile, tuning, firstCrackAtC: 191 });
    // Skips the few readings around a phase change, while the roaster reports the old value.
    const settled = rows.filter(
      (row, i) =>
        row.tS > 65 && rows.slice(Math.max(0, i - 3), i).every((r) => r.phase === row.phase),
    );
    expect(settled.length).toBeGreaterThan(100);
    for (const row of settled) {
      const planned = profile.phases.find((p) => p.name === row.phase)?.heat.pct ?? 0;
      expect(row.heater).toBeLessThanOrEqual(planned + 30);
      expect(row.heater).toBeGreaterThanOrEqual(planned - 20);
    }
  });

  it('holds the fan back when the stall guard trips', async () => {
    const { rows, events } = await simulateAutoRoast({ profile, tuning, firstCrackAtC: 191 });
    expect(events.some((event) => event.kind === 'stall-guard' && event.tripped)).toBe(true);
    const development = rows.filter((row) => row.phase === 'Development');
    expect(development.some((row) => row.fan < 80)).toBe(true);
  });
});
