import { describe, expect, it } from 'vitest';
import { ok } from '@roastpilot/shared';
import { DEFAULT_COOLING_MS, EXTEND_COOLING_MS, ManualRoast } from './manual-roast';
import { manualRoastHarness } from './manual-roast.harness';
import { BEAN_COOL_MAX_MS } from './roast-rules';
import { ROASTER_COOL_MAX_MS } from './roaster-cooldown';

const ALL_OFF = ['heater=0', 'fan=0', 'cooling=0', 'drum=0', 'filter=0'];
const ROASTER_COOLING = ['heater=0', 'cooling=0', 'filter=0', 'fan=100', 'drum=1'];

describe('ManualRoast cooling time', () => {
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

  it('by temperature: ends at the first reading below the target, then the roaster cool-down', async () => {
    const { roast, act, feed, sent, events } = manualRoastHarness({
      options: { coolingBelowC: 90, roasterCoolToC: 60 },
    });
    await act('start', 'drop');
    expect(roast.state.coolingBelowC).toBe(90);
    sent.length = 0;
    await feed([150, 120, 95, 90]);
    expect(roast.state.phase).toBe('cooling');
    await feed([89.5]);
    expect(roast.state).toMatchObject({
      phase: 'done',
      coolingBelowC: null,
      coolingEndsAtMs: null,
      roasterCoolToC: 60,
    });
    expect(roast.state.events.at(-1)).toMatchObject({ kind: 'cool-end', bt: 89.5 });
    expect(sent).toEqual(ROASTER_COOLING);
    expect(events('roast.cooling-reached')[0]?.context).toMatchObject({ belowC: 90, bt: 89.5 });
    await feed([59]);
    expect(roast.state.roasterCoolingSinceMs).toBeNull();
  });

  it('by temperature: ends after 10 min with a warning if BT never gets there', async () => {
    const { clock, roast, act, events } = manualRoastHarness({ options: { coolingBelowC: 70 } });
    await act('start', 'drop');
    await clock.runFor(BEAN_COOL_MAX_MS - 1000);
    expect(roast.state.phase).toBe('cooling');
    await clock.runFor(1000);
    expect(roast.state.phase).toBe('done');
    expect(events('roast.cooling-gave-up')[0]).toMatchObject({
      level: 'warn',
      context: { belowC: 70 },
    });
  });

  it('by temperature: no +1 min, and changing the setting mid-cooling changes nothing', async () => {
    const options: { coolingBelowC: number | null } = { coolingBelowC: 90 };
    const { roast, act, feed } = manualRoastHarness({ options });
    await act('start', 'drop');
    expect(await roast.act('extend-cooling')).toMatchObject({ ok: false });
    options.coolingBelowC = null;
    await feed([85]);
    expect(roast.state.phase).toBe('done');
  });

  it('+1 min only while cooling', async () => {
    const { act, roast } = manualRoastHarness();
    await act('start');
    expect(await roast.act('extend-cooling')).toMatchObject({ ok: false });
  });
});

describe('ManualRoast roaster cool-down', () => {
  it('follows bean cooling while the drum is hot, until it is below 50 °C', async () => {
    const { clock, roast, sent, act, feed, setBt, events } = manualRoastHarness();
    await act('start', 'drop');
    setBt(110);
    sent.length = 0;
    await clock.runFor(DEFAULT_COOLING_MS);
    expect(roast.state).toMatchObject({ phase: 'done', roasterCoolingSinceMs: clock.now() });
    expect(sent).toEqual(ROASTER_COOLING);
    expect(events('roast.roaster-cooling-started')[0]?.context).toEqual({
      reason: 'after-roast',
      toC: 50,
      bt: 110,
    });
    sent.length = 0;
    await feed([90, 70, 50]);
    expect(roast.state.roasterCoolingSinceMs).not.toBeNull();
    await feed([49.8]);
    expect(roast.state.roasterCoolingSinceMs).toBeNull();
    expect(sent).toEqual(ALL_OFF);
    expect(events('roast.roaster-cooling-ended')[0]?.context).toEqual({
      reason: 'cooled',
      bt: 49.8,
    });
  });

  it('cools the roaster to the target set, offered as a setting', async () => {
    const { roast, act, feed } = manualRoastHarness({ options: { roasterCoolToC: 70 } });
    await act('cool-roaster');
    expect(roast.state.roasterCoolToC).toBe(70);
    await feed([75, 70]);
    expect(roast.state.roasterCoolingSinceMs).not.toBeNull();
    await feed([69]);
    expect(roast.state).toMatchObject({ roasterCoolingSinceMs: null, roasterCoolToC: null });
  });

  it('turns everything off as before when the drum is already cool, or the setting is off', async () => {
    const cool = manualRoastHarness();
    await cool.act('start', 'drop');
    cool.setBt(48);
    cool.sent.length = 0;
    await cool.act('end');
    expect(cool.sent).toEqual(ALL_OFF);
    expect(cool.roast.state.roasterCoolingSinceMs).toBeNull();

    const off = manualRoastHarness({ options: { coolRoasterAfter: false } });
    await off.act('start', 'drop');
    off.setBt(110);
    off.sent.length = 0;
    await off.act('end');
    expect(off.sent).toEqual(ALL_OFF);
  });

  it('starts on request in Ready or Done, and Stop ends it', async () => {
    const { roast, sent, act, events } = manualRoastHarness();
    await act('cool-roaster');
    expect(roast.state.roasterCoolingSinceMs).not.toBeNull();
    expect(sent).toEqual(ROASTER_COOLING);
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
    expect(sent).toEqual(['fan=0', 'drum=1', 'filter=1']);
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

  it('after a reconnect, puts the cool-down outputs back', async () => {
    const { roast, sent, act } = manualRoastHarness();
    await act('cool-roaster');
    sent.length = 0;
    await roast.restoreOutputs();
    expect(sent).toEqual(ROASTER_COOLING);
  });

  it('Start ends it and sets the fan back to 0, so it never cuts the heater mid-roast', async () => {
    const { clock, roast, sent, act, feed, events } = manualRoastHarness();
    await act('cool-roaster');
    sent.length = 0;
    await act('start');
    expect(roast.state).toMatchObject({ phase: 'roasting', roasterCoolingSinceMs: null });
    expect(sent).toEqual(['fan=0', 'drum=1', 'filter=1']);
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

  it('does not start after a disconnect or safety stop: cool end turns everything off', async () => {
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
