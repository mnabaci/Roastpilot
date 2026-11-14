import { err, ok } from '@roastpilot/shared';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { silentLogger } from '@roastpilot/core';
import { CONNECTED, fakeApi, renderApp } from '../../test/render-app';
import { RoastersScreen } from './RoastersScreen';
import { card, openWiring, roasters, withInputs } from './wiring-card-fixture';

describe('WiringCard live inputs', () => {
  it('shows TC1–TC4 live while connected, with BT and ET under theirs', async () => {
    renderApp(<RoastersScreen />, { connection: CONNECTED, roasters }, withInputs());
    await openWiring();
    const inputs = within(await screen.findByRole('list', { name: 'Inputs now' }));
    expect(await inputs.findByText('165.2')).toBeInTheDocument();
    const tiles = inputs.getAllByRole('listitem').map((tile) => tile.textContent);
    expect(tiles).toEqual([
      'TC1212.4°CET',
      'TC2165.2°CBT',
      'TC321.9°CNot used',
      'TC422.1°CNot used',
    ]);
  });

  it('drops the last readings when a read call fails, never showing them as live', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let calls = 0;
      const api = fakeApi({
        readRoasterInputs: vi.fn(() => {
          calls++;
          return calls === 1
            ? Promise.resolve(ok([212.4, 165.2, 21.9, 22.1]))
            : Promise.reject(new Error('ipc gone'));
        }),
      });
      renderApp(<RoastersScreen />, { connection: CONNECTED, roasters }, api);
      await openWiring();
      const inputs = within(await screen.findByRole('list', { name: 'Inputs now' }));
      expect(await inputs.findByText('165.2')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });
      expect(inputs.queryByText('165.2')).toBeNull();
      expect(card().getByText("Couldn't read the inputs · check the board")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads one at a time, never stacking calls, and logs a failing board once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let pending = 0;
      let most = 0;
      const api = fakeApi({
        readRoasterInputs: vi.fn(async () => {
          pending++;
          most = Math.max(most, pending);
          // Slower than the 2 s between reads.
          await new Promise((resolve) => setTimeout(resolve, 3000));
          pending--;
          return err({ kind: 'no-reply' as const, command: 'READ' });
        }),
      });
      const warn = vi.fn();
      renderApp(<RoastersScreen />, { connection: CONNECTED, roasters }, api, {
        ...silentLogger,
        warn,
        child: () => ({ ...silentLogger, warn }),
      });
      await openWiring();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16_000);
      });
      expect(most).toBe(1);
      expect(vi.mocked(api.readRoasterInputs).mock.calls.length).toBeGreaterThan(2);
      expect(warn.mock.calls.filter(([event]) => event === 'roasters.inputs-failed')).toHaveLength(
        1,
      );
      expect(card().getByText("Couldn't read the inputs · check the board")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
