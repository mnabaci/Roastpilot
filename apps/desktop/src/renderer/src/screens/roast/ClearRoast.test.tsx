import { err, READY_ROAST } from '@roastpilot/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BEAN } from '../../test/beans';
import { fakeApi, renderApp } from '../../test/render-app';
import { ClearRoast } from './ClearRoast';

const done = { ...READY_ROAST, phase: 'done' as const, chargedAtMs: 0 };
const seed = {
  roast: done,
  readings: [{ atMs: 1000, values: { bt: 40 } }],
  setup: { beanId: BEAN.id, batchG: 350, ghostRoastId: null },
  beans: [BEAN],
};

describe('ClearRoast', () => {
  it('names the bean and batch it would return', async () => {
    renderApp(<ClearRoast />, seed);
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Return 350 g of Yirgacheffe to stock?')).toBeInTheDocument();
  });

  it('keeps the roast when the stock could not be returned', async () => {
    const api = fakeApi({
      adjustStock: vi.fn(() =>
        Promise.resolve(err({ kind: 'storage-failed' as const, message: 'disk full' })),
      ),
    });
    const { stores } = renderApp(<ClearRoast />, seed, api);
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await userEvent.click(screen.getByRole('button', { name: 'Return to stock' }));
    expect(api.adjustStock).toHaveBeenCalledOnce();
    expect(api.roastAction).not.toHaveBeenCalled();
    expect(stores.roast.getState().readings).toHaveLength(1);
    expect(stores.toasts.getState().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        text: "Couldn't return the beans to stock · try again",
      }),
    ]);
  });

  it('says so when the clear itself fails', async () => {
    const api = fakeApi({ roastAction: vi.fn(() => Promise.reject(new Error('ipc'))) });
    const { stores } = renderApp(<ClearRoast />, seed, api);
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep deducted' }));
    await waitFor(() => {
      expect(stores.toasts.getState().toasts.map((t) => t.text)).toEqual([
        "Couldn't clear the roast · try again",
      ]);
    });
  });
});
