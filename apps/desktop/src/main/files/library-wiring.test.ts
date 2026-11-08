import { silentLogger } from '@roastpilot/core';
import { BUILT_IN_ROASTERS } from '@roastpilot/drivers';
import { ok, type Roaster } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { createLibraryKinds } from './library-wiring';

describe('library kinds', () => {
  it('registers beans, profiles and roasters, each writing its own format', async () => {
    const [skywalker] = BUILT_IN_ROASTERS as [Roaster];
    const kinds = createLibraryKinds({
      beans: { read: () => Promise.resolve(ok([])), addAll: () => Promise.resolve(ok([])) },
      profiles: {
        list: () => Promise.resolve([]),
        allNames: () => Promise.resolve(new Map()),
        addAll: () => Promise.resolve(ok(undefined)),
      },
      roasters: {
        all: [skywalker],
        addAll: () => Promise.resolve(ok([])),
        active: () => skywalker,
      },
      newProfileId: () => 'custom-x',
      now: () => new Date(0),
      logger: silentLogger,
    });
    const formats = await Promise.all(
      (['beans', 'profiles', 'roasters'] as const).map(async (kind) => {
        const text = await kinds[kind].exportFile();
        return text.ok ? (JSON.parse(text.value) as { format: string }).format : text.error.kind;
      }),
    );
    expect(formats).toEqual(['roastpilot-beans', 'roastpilot-profiles', 'roastpilot-roasters']);
  });
});
