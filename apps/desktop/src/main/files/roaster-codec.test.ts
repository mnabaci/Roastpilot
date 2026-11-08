import { silentLogger, type RoasterRepository } from '@roastpilot/core';
import { BUILT_IN_ROASTERS } from '@roastpilot/drivers';
import { err, ok, type Roaster } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { RoasterService } from '../roasters/roaster-service';
import { exported, filesOf, without } from './codec-test-kit';
import { roasterCodec } from './roaster-codec';

const [SKYWALKER, SIMULATOR] = BUILT_IN_ROASTERS as [Roaster, Roaster];
const MINE: Roaster = {
  ...SKYWALKER,
  name: 'Kitchen Skywalker',
  connection: { kind: 'serial', path: '/dev/cu.usbserial-1' },
  tempOffsetC: -3,
  maxTempC: 230,
};

/** A real RoasterService on an in-memory store holding `start`. */
async function setup(start: readonly Roaster[] = BUILT_IN_ROASTERS) {
  let stored = [...start];
  const repository = {
    list: () => Promise.resolve(ok(stored)),
    addAll: (list) => {
      const added = list.map((r, i) => ({ ...r, id: stored.length + 1 + i }));
      stored = [...stored, ...added];
      return Promise.resolve(ok(added));
    },
  } as RoasterRepository;
  const roasters = new RoasterService({
    repository,
    inUse: () => false,
    onChange: () => undefined,
    logger: silentLogger,
  });
  await roasters.load();
  return { codec: roasterCodec({ roasters }), roasters };
}

describe('roaster files', () => {
  it('carry the record without id, port or active flag', async () => {
    const text = await exported('roasters', (await setup([MINE])).codec, [1]);
    const [carried] = (JSON.parse(text) as { roasters: Record<string, unknown>[] }).roasters;
    const record = without(MINE, 'id', 'connection', 'active');
    expect(carried).toEqual(record);
    expect(text).not.toContain('usbserial');
  });

  it('round trip: comes in with no port, not active', async () => {
    const text = await exported('roasters', (await setup([MINE])).codec);
    const { codec, roasters } = await setup();
    expect(await filesOf('roasters', codec).importFile(text)).toEqual(
      ok({ added: 1, skipped: 0, newestId: 3 }),
    );
    expect(roasters.all.at(-1)).toEqual({ ...MINE, id: 3, connection: null, active: false });
    expect(roasters.active().name).toBe('Skywalker');
  });

  it('the same record is already here; a changed one comes in as "(imported)"', async () => {
    const text = await exported('roasters', (await setup()).codec);
    const { codec, roasters } = await setup([SKYWALKER, { ...SIMULATOR, maxTempC: 200 }]);
    expect(await filesOf('roasters', codec).importFile(text)).toEqual(
      ok({ added: 1, skipped: 1, newestId: 3 }),
    );
    expect(roasters.all.map((r) => r.name)).toEqual([
      'Skywalker',
      'Simulator',
      'Simulator (imported)',
    ]);
  });

  it('refuses a record above its model limits, or a model this app does not know', async () => {
    const { codec } = await setup();
    const fileOf = (roaster: object) =>
      JSON.stringify({
        format: 'roastpilot-roasters',
        version: 1,
        exportedAt: '',
        roasters: [roaster],
      });
    const record = without(SKYWALKER, 'id', 'connection', 'active');
    expect(
      await filesOf('roasters', codec).importFile(fileOf({ ...record, maxTempC: 260 })),
    ).toEqual(
      err({
        kind: 'bad-item',
        name: 'Skywalker',
        reason: 'At most 240 °C on this model (maxTempC)',
      }),
    );
    const unknown = await filesOf('roasters', codec).importFile(
      fileOf({ ...record, model: 'behmor' }),
    );
    expect(unknown.ok ? undefined : unknown.error.kind).toBe('bad-item');
  });
});
