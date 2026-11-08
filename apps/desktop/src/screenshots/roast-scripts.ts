import type { ProfileId, RoastAction, RoastResult, RoastSetup } from '@roastpilot/shared';
import type { HeadlessApp } from './headless-app';

/** First crack is pressed here, as a roaster hearing it would (the simulator makes no sound). */
const FIRST_CRACK_C = 191;
const MINUTE_MS = 60_000;

/** Presses First crack once the beans reach it, as the roaster would on hearing it. */
async function firstCrackWhenHeard(app: HeadlessApp) {
  const { phase } = app.services.roast.state;
  const bt = app.services.snapshot().readings.at(-1)?.values.bt ?? 0;
  if (phase === 'roasting' && bt >= FIRST_CRACK_C) await act(app, 'first-crack');
}

/**
 * Runs the fake clock a second at a time until `done`, pressing First crack when it comes; throws
 * past `limitMs`, since the script no longer matches the app.
 */
async function runUntil(
  app: HeadlessApp,
  what: string,
  done: () => boolean,
  limitMs: number,
  eachSecond: () => Promise<void> = () => Promise.resolve(),
) {
  const endMs = app.clock.now() + limitMs;
  while (!done()) {
    if (app.clock.now() >= endMs) throw new Error(`Sample roast: no ${what} in ${limitMs} ms`);
    await app.clock.runFor(1_000);
    await firstCrackWhenHeard(app);
    await eachSecond();
  }
}

/** Seconds since charge on the roast in progress; undefined before charge. */
function roastSeconds(app: HeadlessApp): number | undefined {
  const charged = app.services.roast.state.chargedAtMs;
  return charged === null ? undefined : (app.clock.now() - charged) / 1_000;
}

/** Picks Auto or Manual and the profile, as Settings and the profile picker do. */
export async function chooseMode(app: HeadlessApp, mode: 'auto' | 'manual', profile: ProfileId) {
  const { settings } = app.services;
  const saved = await settings.set({ ...settings.latest, roastMode: mode, autoProfile: profile });
  if (!saved.ok) throw new Error(`Settings not saved: ${saved.error.message}`);
}

async function act(app: HeadlessApp, action: RoastAction) {
  const done = await app.services.roast.act(action);
  if (!done.ok) throw new Error(`Roast action ${action} refused: ${JSON.stringify(done.error)}`);
}

/** Auto's preheat, Charge soon and Start: the roast is charged when this returns. */
export async function autoPreheatAndCharge(app: HeadlessApp, setup: RoastSetup) {
  const { services } = app;
  services.beans.setSetup(setup);
  await act(app, 'preheat');
  await runUntil(
    app,
    'add beans',
    () => services.pilot.status.preheatStep === 'add-beans',
    40 * MINUTE_MS,
  );
  const soon = services.pilot.chargeSoon(app.clock.now());
  if (!soon.ok) throw new Error(`Charge soon refused: ${JSON.stringify(soon.error)}`);
  await runUntil(
    app,
    'beans in',
    () => services.pilot.status.preheatStep === 'beans-in',
    MINUTE_MS,
  );
  await act(app, 'start');
}

/** Auto roasts on until `untilS` after charge, pressing First crack when the beans reach it. */
export async function autoRoastFor(app: HeadlessApp, untilS: number) {
  await runUntil(
    app,
    `${untilS} s of roast`,
    () => (roastSeconds(app) ?? 0) >= untilS,
    25 * MINUTE_MS,
  );
}

/** A whole Auto roast to the end of bean cooling, then the result is saved and the screen cleared. */
export async function wholeAutoRoast(
  app: HeadlessApp,
  setup: RoastSetup,
  result: Omit<RoastResult, 'id'>,
) {
  await autoPreheatAndCharge(app, setup);
  // Bean cooling, then drum cooling, as after any roast.
  await runUntil(
    app,
    'the end of cooling',
    () => app.services.roast.state.phase === 'done',
    40 * MINUTE_MS,
  );
  await runUntil(
    app,
    'a cool drum',
    () => app.services.roast.state.roasterCoolingSinceMs === null,
    40 * MINUTE_MS,
  );
  const id = app.services.recorder.currentId;
  if (id === null) throw new Error('Sample roast was not saved');
  const saved = await app.services.history.saveResult({ ...result, id });
  if (!saved.ok) throw new Error(`Roast result not saved: ${JSON.stringify(saved.error)}`);
  await act(app, 'clear');
  return id;
}

/** Heater and fan by hand, as the sliders set them. */
async function byHand(app: HeadlessApp, heater: number, fan: number) {
  for (const [channel, value] of [
    ['heater', heater],
    ['fan', fan],
  ] as const) {
    const set = await app.services.setOutputByHand(channel, value);
    if (!set.ok) throw new Error(`Slider ${channel} refused: ${JSON.stringify(set.error)}`);
  }
}

/**
 * A manual roast: preheat by hand, charge, then follow the coach's cards (Apply) until `followS`;
 * from there it waits, and stops at the first card that changes heater and fan after `fromS`.
 */
export async function manualRoastToCoachCard(
  app: HeadlessApp,
  setup: RoastSetup,
  { followS, fromS }: { followS: number; fromS: number },
) {
  const { services } = app;
  services.beans.setSetup(setup);
  await act(app, 'preheat');
  await byHand(app, 100, 30);
  const bt = () => services.snapshot().readings.at(-1)?.values.bt ?? 0;
  await runUntil(app, 'a hot drum', () => bt() >= 160, 30 * MINUTE_MS);
  await byHand(app, 60, 30);
  await runUntil(app, 'charge temperature', () => bt() >= 178, 30 * MINUTE_MS);
  await byHand(app, 0, 30);
  await act(app, 'start');
  const card = () => {
    const advice = services.coach.status.advice;
    return advice?.kind === 'setting' ? advice : undefined;
  };
  await runUntil(
    app,
    'a coach card on heater and fan',
    () => {
      const seconds = roastSeconds(app) ?? 0;
      const shown = card();
      return seconds >= fromS && shown?.heater !== undefined && shown.fan !== undefined;
    },
    15 * MINUTE_MS,
    async () => {
      const shown = card();
      if (shown && (roastSeconds(app) ?? 0) < followS) {
        const applied = await services.coachActions.apply(shown.id);
        if (!applied.ok) throw new Error(`Apply refused: ${JSON.stringify(applied.error)}`);
      }
    },
  );
}
