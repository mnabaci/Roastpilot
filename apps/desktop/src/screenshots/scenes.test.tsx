import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { PlotEngineProvider } from '@roastpilot/ui';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { fakePlotEngine } from '../renderer/src/test/fake-plot-engine';
import type { SampleWorld } from './app-state';
import { buildSampleWorld } from './sample-world';
import { sceneDeps } from './scene-deps';
import { SceneApp } from './SceneApp';
import { SCENES } from './scenes';

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
    // jsdom has no canvas: the chart draws through a fake engine (its own tests live in packages/ui).
    render(
      <PlotEngineProvider value={fakePlotEngine}>
        <SceneApp deps={await sceneDeps(world[scene.moment], scene.screen, logger)} />
      </PlotEngineProvider>,
    );
    await scene.prepare();
    expect(screen.queryByText(/hit a problem/)).not.toBeInTheDocument();
    expect(problems).toEqual([]);
  });
});
