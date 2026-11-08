import type { BeanFields, BeanId, RoastDetail } from '@roastpilot/shared';
import type { AppState, SampleWorld } from './app-state';
import { startHeadlessApp, type HeadlessApp } from './headless-app';
import {
  autoPreheatAndCharge,
  autoRoastFor,
  chooseMode,
  manualRoastToCoachCard,
  wholeAutoRoast,
} from './roast-scripts';

/** A bean as the Add bean form saves it; only what the sample sets differs from empty. */
const bean = (fields: Partial<BeanFields> & Pick<BeanFields, 'name' | 'origin'>): BeanFields => ({
  process: 'washed',
  variety: null,
  altitudeM: null,
  densityGL: null,
  moisturePct: null,
  screen: null,
  decaf: false,
  supplier: null,
  lowStockG: 500,
  notes: null,
  ...fields,
});

const GUJI = bean({
  name: 'Ethiopia Guji',
  origin: 'Ethiopia',
  variety: 'Heirloom',
  altitudeM: 1950,
  moisturePct: 10.5,
});
const HUILA = bean({ name: 'Colombia Huila', origin: 'Colombia', process: 'natural' });

const BATCH_G = 375;

async function addBean(app: HeadlessApp, fields: BeanFields, grams: number): Promise<BeanId> {
  const added = await app.services.beans.add(fields);
  if (!added.ok) throw new Error(`Bean not added: ${JSON.stringify(added.error)}`);
  const stocked = await app.services.beans.addStock({
    beanId: added.value,
    grams,
    purchasedAt: '2026-11-02',
    plan: null,
  });
  if (!stocked.ok) throw new Error(`Stock not added: ${JSON.stringify(stocked.error)}`);
  return added.value;
}

/**
 * The same start for every scene: the Simulator connected, two beans in stock, a copy of a
 * built-in profile, and three Auto roasts this week. The first, 5★, is the ghost to beat.
 */
async function seededApp() {
  const app = await startHeadlessApp();
  await app.connectSimulator();
  const guji = await addBean(app, GUJI, 2000);
  const huila = await addBean(app, HUILA, 1000);
  const copied = await app.services.profiles.duplicate('light-steps');
  if (!copied.ok) throw new Error(`Profile not copied: ${JSON.stringify(copied.error)}`);
  const setup = (beanId: BeanId) => ({ beanId, batchG: BATCH_G, ghostRoastId: null });

  await chooseMode(app, 'auto', 'light-curve');
  app.setWallClock('2026-11-04T17:20:00Z');
  const best = await wholeAutoRoast(app, setup(guji), {
    batchG: BATCH_G,
    roastedG: 321,
    rating: 5,
    isFavourite: true,
    notes: 'Jasmine and peach, clean finish',
  });
  app.setWallClock('2026-11-06T09:40:00Z');
  await wholeAutoRoast(app, setup(guji), {
    batchG: BATCH_G,
    roastedG: 319,
    rating: 4,
    isFavourite: false,
    notes: null,
  });
  await chooseMode(app, 'auto', 'light-steps');
  app.setWallClock('2026-11-07T16:10:00Z');
  await wholeAutoRoast(app, setup(huila), {
    batchG: BATCH_G,
    roastedG: 322,
    rating: 4,
    isFavourite: false,
    notes: null,
  });
  return { app, guji, best };
}

/** What a window would load from main right now. */
async function stateOf(app: HeadlessApp): Promise<AppState> {
  const { services } = app;
  const roasts = await services.history.list();
  const details: RoastDetail[] = [];
  for (const { id } of roasts) {
    const read = await services.history.get(id);
    if (!read.ok) throw new Error(`Roast ${id} not read: ${JSON.stringify(read.error)}`);
    details.push(read.value);
  }
  const state: AppState = {
    snapshot: services.snapshot(),
    settings: services.settings.latest,
    profiles: await services.profiles.list(),
    roasters: [...services.roasters.all],
    beans: await services.beans.list(),
    roasts,
    details,
  };
  // Plain data only, as it crosses IPC (and the Storybook bundle) as JSON.
  return JSON.parse(JSON.stringify(state)) as AppState;
}

async function idle(): Promise<AppState> {
  const { app } = await seededApp();
  await chooseMode(app, 'auto', 'light-curve');
  // A few idle readings, as a connected roaster sends.
  await app.clock.runFor(3_000);
  return stateOf(app);
}

/** Saturday's roast is today too: Light · Curve again, chasing the 5★ one. */
async function autoMidRoast(): Promise<AppState> {
  const { app, guji, best } = await seededApp();
  await chooseMode(app, 'auto', 'light-curve');
  app.setWallClock('2026-11-08T10:00:00Z');
  await autoPreheatAndCharge(app, { beanId: guji, batchG: BATCH_G, ghostRoastId: best });
  await autoRoastFor(app, 6 * 60);
  return stateOf(app);
}

async function manualWithCoach(): Promise<AppState> {
  const { app, guji, best } = await seededApp();
  await chooseMode(app, 'manual', 'light-steps');
  app.setWallClock('2026-11-08T11:00:00Z');
  await manualRoastToCoachCard(
    app,
    { beanId: guji, batchG: BATCH_G, ghostRoastId: best },
    { followS: 5 * 60 + 30, fromS: 6 * 60 },
  );
  return stateOf(app);
}

/**
 * The README's sample world, made by running main's own services on the Simulator and a fake
 * clock: no network, no randomness, the same numbers every run.
 */
export async function buildSampleWorld(): Promise<SampleWorld> {
  return { idle: await idle(), auto: await autoMidRoast(), manual: await manualWithCoach() };
}
