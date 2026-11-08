import { ok, type Bean, type ProfileEntry } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { beanCodec } from './bean-codec';
import { exported, filesOf, without } from './codec-test-kit';

const GUJI: Bean = {
  id: 4,
  name: 'Guji',
  origin: 'Ethiopia',
  process: 'washed',
  variety: 'Heirloom',
  altitudeM: 2100,
  densityGL: 780,
  moisturePct: 10.5,
  screen: 15,
  decaf: false,
  supplier: 'Sweet Maria',
  lowStockG: 500,
  notes: 'Jasmine',
  profileId: 'custom-guji',
  greenG: 1200,
  roastedG: 340,
  archived: true,
  avgLossPct: 14,
  batchPlan: null,
};

const entry = (id: string, name: string) => ({ profile: { id, name } }) as ProfileEntry;

/** Beans here as `here`; the active roaster's profiles as `active`; every name as `names`. */
function setup(here: Bean[], active: ProfileEntry[] = []) {
  const beans = {
    read: vi.fn(() => Promise.resolve(ok(here))),
    addAll: vi.fn((list: readonly unknown[]) => Promise.resolve(ok(list.map((_, i) => 20 + i)))),
  };
  const profiles = { list: () => Promise.resolve(active) };
  const profileNames = () => Promise.resolve(ok(new Map([['custom-guji', 'Guji light']])));
  return { beans, codec: beanCodec({ beans, profiles, profileNames }) };
}

describe('bean files', () => {
  it('carry the fields and the profile by name; not stock, purchases, archive or id', async () => {
    const text = await exported('beans', setup([GUJI]).codec);
    const [bean] = (JSON.parse(text) as { beans: Record<string, unknown>[] }).beans;
    expect(bean).toEqual({
      name: 'Guji',
      origin: 'Ethiopia',
      process: 'washed',
      variety: 'Heirloom',
      altitudeM: 2100,
      densityGL: 780,
      moisturePct: 10.5,
      screen: 15,
      decaf: false,
      supplier: 'Sweet Maria',
      lowStockG: 500,
      notes: 'Jasmine',
      profileName: 'Guji light',
    });
  });

  it('export this bean: only the one named', async () => {
    const other = { ...GUJI, id: 5, name: 'Huila' };
    const text = await exported('beans', setup([GUJI, other]).codec, [5]);
    expect((JSON.parse(text) as { beans: { name: string }[] }).beans.map((b) => b.name)).toEqual([
      'Huila',
    ]);
  });

  it('round trip: a bean comes in, its profile linked by name on the active roaster', async () => {
    const text = await exported('beans', setup([GUJI]).codec);
    const { beans, codec } = setup(
      [],
      [entry('light-steps', 'Light steps'), entry('p9', 'Guji light')],
    );
    expect(await filesOf('beans', codec).importFile(text)).toEqual(
      ok({ added: 1, skipped: 0, newestId: 20 }),
    );
    const fields = without(
      GUJI,
      'id',
      'profileId',
      'greenG',
      'roastedG',
      'archived',
      'avgLossPct',
      'batchPlan',
    );
    expect(beans.addAll).toHaveBeenCalledWith([{ fields, profileId: 'p9' }]);
  });

  it('links no profile when the active roaster has none of that name', async () => {
    const text = await exported('beans', setup([GUJI]).codec);
    const { beans, codec } = setup([], [entry('light-steps', 'Light steps')]);
    await filesOf('beans', codec).importFile(text);
    expect(beans.addAll).toHaveBeenCalledWith([expect.objectContaining({ profileId: null })]);
  });

  it('the same bean is already here, whatever its stock or profile link here', async () => {
    const text = await exported('beans', setup([GUJI]).codec);
    const mine = { ...GUJI, greenG: 0, profileId: null, archived: false };
    const { beans, codec } = setup([mine]);
    expect(await filesOf('beans', codec).importFile(text)).toEqual(
      ok({ added: 0, skipped: 1, newestId: null }),
    );
    expect(beans.addAll).not.toHaveBeenCalled();
  });

  it('a bean of the same name with other fields comes in as "(imported)"', async () => {
    const text = await exported('beans', setup([GUJI]).codec);
    const { beans, codec } = setup([{ ...GUJI, origin: 'Kenya' }]);
    await filesOf('beans', codec).importFile(text);
    expect(beans.addAll).toHaveBeenCalledWith([
      {
        fields: {
          ...without(
            GUJI,
            'id',
            'profileId',
            'greenG',
            'roastedG',
            'archived',
            'avgLossPct',
            'batchPlan',
          ),
          name: 'Guji (imported)',
          origin: 'Ethiopia',
        },
        profileId: null,
      },
    ]);
  });

  it('refuses the file when a bean fails its checks, saying which and why', async () => {
    const text = JSON.stringify({
      format: 'roastpilot-beans',
      version: 1,
      exportedAt: '',
      beans: [{ ...GUJI, origin: '', profileName: null }],
    });
    expect(await filesOf('beans', setup([]).codec).importFile(text)).toEqual({
      ok: false,
      error: { kind: 'bad-item', name: 'Guji', reason: 'Origin: Enter an origin' },
    });
  });
});
