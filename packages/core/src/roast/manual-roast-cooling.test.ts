import { describe, expect, it } from 'vitest';
import { ok } from '@roastpilot/shared';
import { DEFAULT_COOLING_MS, EXTEND_COOLING_MS, ManualRoast } from './manual-roast';
import { manualRoastHarness } from './manual-roast.harness';
import { ROASTER_COOL_AFTER_DROP_MAX_MS, ROASTER_COOL_MAX_MS } from './roaster-cooldown';

const ALL_OFF = ['heater=0', 'fan=0', 'cooling=0', 'drum=0', 'filter=0'];
const BEANS = ['heater=0', 'fan=100', 'cooling=100', 'drum=1', 'filter=1'];
const DRUM = ['heater=0', 'fan=100', 'cooling=0', 'drum=1', 'filter=0'];
const DRUM_WITH_COOLER = ['heater=0', 'fan=100', 'cooling=100', 'drum=1', 'filter=0'];

describe('ManualRoast bean cooling time', () => {
  it('counts down the Cooling time setting', async () => {
    const { clock, roast, act } = manualRoastHarness({ options: { coolingMs: 2 * 60_000 } });
    await act('start', 'drop');
    expect(roast.state.coolingEndsAtMs).toBe(clock.now() + 2 * 60_000);
    await clock.runFor(2 * 60_000);
    expect(roast.state.phase).toBe('done');
  });

  it('+1 min moves the end a minute later, as often as you like', async () => {
    const { clock, roast, act } = manualRoastHarness();
    await act('start', 'drop');
    const endsAtMs = roast.state.coolingEndsAtMs ?? 0;
    await clock.runFor(60_000);
    await act('extend-cooling', 'extend-cooling');
    expect(roast.state.coolingEndsAtMs).toBe(endsAtMs + 2 * EXTEND_COOLING_MS);
    await clock.runFor(DEFAULT_COOLING_MS - 60_000);
    expect(roast.state.phase).toBe('cooling');
    await clock.runFor(2 * EXTEND_COOLING_MS);
    expect(roast.state.phase).toBe('done');
  });

  it('+1 min after a late timer still gives a minute from now', async () => {
    // A busy event loop: the cooling timer hasn't fired although its end has passed.
    let nowMs = 0;
    const lateClock = { now: () => nowMs, delay: () => new Promise<void>(() => undefined) };
    const roast = new ManualRoast({
      clock: lateClock,
      setOutput: () => Promise.resolve(ok(undefined)),
      latestBt: () => 100,
      onChange: () => undefined,
      onNewRoast: () => undefined,
      onRoastStarted: () => undefined,
      onRoastEnded: () => undefined,
    });
    await roast.act('start');
    await roast.act('drop');
    nowMs = DEFAULT_COOLING_MS + 5000;
    await roast.act('extend-cooling');
    expect(roast.state.coolingEndsAtMs).toBe(nowMs + EXTEND_COOLING_MS);
  });

  it('+1 min only while cooling', async () => {
    const { act, roast } = manualRoastHarness();
    await act('start');
    expect(await roast.act('extend-cooling')).toMatchObject({ ok: false });
  });
});

describe('ManualRoast drum cooling', () => {
  it('starts on request in Ready or Done, and Stop ends it', async () => {
    const { roast, sent, act, events } = manualRoastHarness();
    await act('cool-roaster');
    expect(roast.state.roasterCoolingSinceMs).not.toBeNull();
    expect(sent).toEqual(DRUM);
    expect(events('roast.roaster-cooling-started')[0]?.context).toMatchObject({ reason: 'asked' });
    sent.length = 0;
    await act('stop-cooling-roaster');
    expect(roast.state.roasterCoolingSinceMs).toBeNull();
    expect(sent).toEqual(ALL_OFF);
    expect(events('roast.roaster-cooling-ended')[0]?.context).toMatchObject({ reason: 'stopped' });
    sent.length = 0;
    await act('stop-cooling-roaster');
    expect(sent).toEqual([]);
    await act('preheat');
    expect(await roast.act('cool-roaster')).toMatchObject({ ok: false });
  });

  it('gives up after 15 min with a warning, whatever the probe says', async () => {
    const { clock, roast, act, feed, events } = manualRoastHarness();
    await act('cool-roaster');
    clock.advance(ROASTER_COOL_MAX_MS - 1000);
    await feed([90]);
    expect(roast.state.roasterCoolingSinceMs).toBeNull();
    expect(events('roast.roaster-cooling-ended')[0]).toMatchObject({
      level: 'warn',
      context: { reason: 'gave-up' },
    });
  });

  it('Preheat ends it and sets the fan back to 0 before the drum and filter come on', async () => {
    const { roast, sent, act, events } = manualRoastHarness();
    await act('cool-roaster');
    sent.length = 0;
    await act('preheat');
    expect(roast.state).toMatchObject({ phase: 'preheat', roasterCoolingSinceMs: null });
    expect(sent).toEqual(['fan=0', 'cooling=0', 'drum=1', 'filter=1']);
    expect(events('roast.roaster-cooling-ended')[0]?.context).toMatchObject({ reason: 'preheat' });
  });

  it('Clear keeps it running', async () => {
    const { roast, sent, act } = manualRoastHarness();
    await act('cool-roaster');
    sent.length = 0;
    await act('clear');
    expect(roast.state.roasterCoolingSinceMs).not.toBeNull();
    expect(sent).toEqual([]);
  });

  it('a safety stop or a disconnect ends it without sending anything', async () => {
    const { roast, sent, act, events } = manualRoastHarness();
    roast.stopRoasterCooling('safety-stop');
    expect(events('roast.roaster-cooling-ended')).toHaveLength(0);
    await act('cool-roaster');
    sent.length = 0;
    roast.stopRoasterCooling('disconnected');
    expect(roast.state.roasterCoolingSinceMs).toBeNull();
    expect(sent).toEqual([]);
    expect(events('roast.roaster-cooling-ended')[0]?.context).toMatchObject({
      reason: 'disconnected',
    });
  });

  it('after a reconnect, puts the drum cooling outputs back', async () => {
    const { roast, sent, act } = manualRoastHarness();
    await act('cool-roaster');
    sent.length = 0;
    await roast.restoreOutputs();
    expect(sent).toEqual(DRUM);
  });

  it('Start ends it and sets the fan back to 0, so it never cuts the heater mid-roast', async () => {
    const { clock, roast, sent, act, feed, events } = manualRoastHarness();
    await act('cool-roaster');
    sent.length = 0;
    await act('start');
    expect(roast.state).toMatchObject({ phase: 'roasting', roasterCoolingSinceMs: null });
    expect(sent).toEqual(['fan=0', 'cooling=0', 'drum=1', 'filter=1']);
    expect(events('roast.roaster-cooling-ended')[0]?.context).toMatchObject({
      reason: 'roast-started',
    });
    sent.length = 0;
    clock.advance(ROASTER_COOL_MAX_MS);
    await feed([40]);
    expect(sent).toEqual([]);
  });

  it('turning the heater on ends it and leaves your outputs as they are', async () => {
    const { roast, sent, act, events } = manualRoastHarness();
    await act('cool-roaster');
    sent.length = 0;
    roast.outputRequested('fan', 60);
    roast.outputRequested('heater', 0);
    expect(roast.state.roasterCoolingSinceMs).not.toBeNull();
    roast.outputRequested('heater', 40);
    expect(roast.state.roasterCoolingSinceMs).toBeNull();
    expect(sent).toEqual([]);
    expect(events('roast.roaster-cooling-ended')[0]?.context).toMatchObject({
      reason: 'heater-on',
    });
  });

  it('does not start after a disconnect or safety stop: bean cooling ends with everything off', async () => {
    const { clock, roast, sent, act } = manualRoastHarness({ canCoolRoaster: false });
    await act('start', 'drop');
    sent.length = 0;
    await clock.runFor(DEFAULT_COOLING_MS);
    expect(roast.state).toMatchObject({ phase: 'done', roasterCoolingSinceMs: null });
    expect(sent).toEqual(ALL_OFF);
    expect(await roast.act('cool-roaster')).toMatchObject({ ok: false });
    expect(roast.state.roasterCoolingSinceMs).toBeNull();
  });
});

describe('ManualRoast bean and drum cooling from Drop', () => {
  /** Roasting with a hot drum, then Drop; sends cleared. */
  async function dropped(options: Parameters<typeof manualRoastHarness>[0] = {}) {
    const harness = manualRoastHarness(options);
    await harness.act('start');
    harness.setBt(200);
    await harness.act('drop');
    harness.sent.length = 0;
    return harness;
  }

  it('both start at Drop; the beans end first, then the drum below 50 °C', async () => {
    const { clock, roast, sent, act, feed, setBt, events } = manualRoastHarness();
    await act('start');
    setBt(200);
    sent.length = 0;
    await act('drop');
    expect(roast.state).toMatchObject({
      phase: 'cooling',
      roasterCoolingSinceMs: clock.now(),
      roasterCoolToC: 50,
    });
    expect(sent).toEqual(BEANS);
    expect(events('roast.roaster-cooling-started')[0]?.context).toEqual({
      reason: 'after-roast',
      toC: 50,
      bt: 200,
    });
    sent.length = 0;
    await clock.runFor(DEFAULT_COOLING_MS);
    expect(roast.state.phase).toBe('done');
    expect(sent).toEqual(DRUM);
    sent.length = 0;
    await feed([90, 50]);
    expect(roast.state.roasterCoolingSinceMs).not.toBeNull();
    await feed([49.8]);
    expect(roast.state.roasterCoolingSinceMs).toBeNull();
    expect(sent).toEqual(ALL_OFF);
    expect(events('roast.roaster-cooling-ended')[0]?.context).toEqual({
      reason: 'cooled',
      bt: 49.8,
    });
  });

  it('with the bean cooler helping, it stays on until the drum is cool', async () => {
    const { clock, sent, feed } = await dropped({ options: { coolerHelpsDrum: true } });
    await clock.runFor(DEFAULT_COOLING_MS);
    expect(sent).toEqual(DRUM_WITH_COOLER);
    sent.length = 0;
    await feed([45]);
    expect(sent).toEqual(ALL_OFF);
  });

  it('the drum cooling first leaves the beans cooling', async () => {
    const { roast, sent, feed } = await dropped();
    await feed([45]);
    expect(roast.state).toMatchObject({ phase: 'cooling', roasterCoolingSinceMs: null });
    expect(sent).toEqual(BEANS);
  });

  it('Finish cooling now ends the beans only; the drum keeps cooling', async () => {
    const { roast, sent, act } = await dropped();
    await act('end');
    expect(roast.state.phase).toBe('done');
    expect(roast.state.roasterCoolingSinceMs).not.toBeNull();
    expect(sent).toEqual(DRUM);
  });

  it('no drum cooling with the setting off: bean cooling ends with everything off', async () => {
    const { roast, sent, act } = await dropped({ options: { coolRoasterAfter: false } });
    expect(roast.state.roasterCoolingSinceMs).toBeNull();
    await act('end');
    expect(sent).toEqual(ALL_OFF);
  });

  it('no drum cooling when the drum is already below its target', async () => {
    const { roast, act, setBt } = manualRoastHarness();
    await act('start');
    setBt(48);
    await act('drop');
    expect(roast.state).toMatchObject({ phase: 'cooling', roasterCoolingSinceMs: null });
  });

  it('gives up 20 min after Drop with a warning', async () => {
    const { clock, roast, feed, events } = await dropped();
    clock.advance(ROASTER_COOL_AFTER_DROP_MAX_MS - 2000);
    await feed([90]);
    expect(roast.state.roasterCoolingSinceMs).not.toBeNull();
    await feed([90]);
    expect(roast.state.roasterCoolingSinceMs).toBeNull();
    expect(events('roast.roaster-cooling-ended')[0]).toMatchObject({
      level: 'warn',
      context: { reason: 'gave-up' },
    });
  });

  it('after a reconnect, puts back the outputs of the coolings running', async () => {
    const { clock, roast, sent } = await dropped({ options: { coolerHelpsDrum: true } });
    await roast.restoreOutputs();
    expect(sent).toEqual(BEANS);
    await clock.runFor(DEFAULT_COOLING_MS);
    sent.length = 0;
    await roast.restoreOutputs();
    expect(sent).toEqual(DRUM_WITH_COOLER);
  });

  it('Preheat for the next batch ends it, with the fan and bean cooler back to 0', async () => {
    const { clock, roast, sent, act } = await dropped({ options: { coolerHelpsDrum: true } });
    await clock.runFor(DEFAULT_COOLING_MS);
    sent.length = 0;
    await act('preheat');
    expect(roast.state).toMatchObject({ phase: 'preheat', roasterCoolingSinceMs: null });
    expect(sent).toEqual(['fan=0', 'cooling=0', 'drum=1', 'filter=1']);
  });

  it('+1 min is always allowed in Cooling', async () => {
    const { roast } = await dropped();
    expect(await roast.act('extend-cooling')).toEqual({ ok: true, value: undefined });
  });
});
