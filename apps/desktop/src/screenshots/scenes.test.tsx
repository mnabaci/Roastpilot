import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import type * as Ui from '@roastpilot/ui';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { SampleWorld } from './app-state';
import { buildSampleWorld } from './sample-world';
import { sceneDeps } from './scene-deps';
import { SceneApp } from './SceneApp';
import { SCENES } from './scenes';

// jsdom has no canvas; the chart's own tests live in packages/ui.
vi.mock('@roastpilot/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  RoastChart: (await import('../renderer/src/test/fake-ui')).FakeRoastChart,
}));

// Guards `pnpm screenshots`: a screen change that breaks a README scene fails here, not later.
describe('README scenes', () => {
  let world: SampleWorld;

  beforeAll(async () => {
    world = await buildSampleWorld();
  });

  it('come from roasts the Simulator really roasted', () => {
    expect(world.idle.roasts.map((r) => r.rating)).toEqual([4, 4, 5]);
    expect(world.auto.snapshot.roast.phase).toBe('roasting');
    expect(world.auto.snapshot.auto.phaseName).toBe('Maillard');
    expect(world.manual.snapshot.coach.advice).toMatchObject({
      kind: 'setting',
      heater: expect.anything() as unknown,
      fan: expect.anything() as unknown,
    });
  });

  it('are the same every time', async () => {
    expect(JSON.stringify(await buildSampleWorld())).toBe(JSON.stringify(world));
  });

  it.each(SCENES)('$id draws and gets ready without an error', async (scene) => {
    const problems: LogEntry[] = [];
    const logger = createLogger(
      {
        write: (entry) => {
          if (entry.level === 'error' || entry.level === 'warn') problems.push(entry);
        },
      },
      'scene',
    );
    render(<SceneApp deps={await sceneDeps(world[scene.moment], scene.screen, logger)} />);
    await scene.prepare();
    expect(screen.queryByText(/hit a problem/)).not.toBeInTheDocument();
    expect(problems).toEqual([]);
  });
});
