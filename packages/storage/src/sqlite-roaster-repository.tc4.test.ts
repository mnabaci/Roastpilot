import { DEFAULT_TC4_WIRING } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { listed, setup } from './roaster-repository-fixture';

describe('SqliteRoasterRepository with a generic TC4', () => {
  it('keeps a generic TC4 record with its wiring and minimum fan', async () => {
    const { repository } = setup();
    const [skywalker] = await listed(repository);
    if (!skywalker) throw new Error('no roaster');
    const { id, ...fields } = skywalker;
    expect(id).toBe(1);
    const wiring = { ...DEFAULT_TC4_WIRING, etInput: 0, fanOutput: 'IO3' } as const;
    await repository.add({
      ...fields,
      name: 'Popper',
      model: 'tc4',
      wiring,
      minFanHeatingPct: 40,
      active: false,
    });
    expect((await listed(repository)).at(-1)).toMatchObject({
      name: 'Popper',
      model: 'tc4',
      wiring,
      minFanHeatingPct: 40,
    });
  });

  it('reads a minimum fan on a model without wiring as 0, as the record rules allow', async () => {
    const { repository, sqlite } = setup();
    sqlite.exec('UPDATE roasters SET min_fan_heating_pct = 40 WHERE id = 1');
    expect((await listed(repository))[0]?.minFanHeatingPct).toBe(0);
  });

  it('skips a generic TC4 whose wiring no longer reads, never guessing its heater output', async () => {
    const { repository, sqlite, entries } = setup();
    sqlite.exec(`UPDATE roasters SET model = 'tc4', wiring = '{"heater":"D9"}' WHERE id = 2`);
    expect((await listed(repository)).map((r) => r.id)).toEqual([1]);
    expect(entries.map((e) => e.event)).toContain('storage.roaster-unreadable');
  });
});
