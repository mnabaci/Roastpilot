import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render-app';
import { useRun } from './use-run';

function Runner({ call, failed }: { call: () => Promise<unknown>; failed?: string }) {
  const run = useRun();
  return (
    <button
      type="button"
      onClick={() => {
        run('test.failed', call, failed ? { failed } : undefined);
      }}
    >
      Go
    </button>
  );
}

describe('useRun', () => {
  it('shows the error toast when the call rejects', async () => {
    const { stores } = renderApp(
      <Runner call={() => Promise.reject(new Error('ipc'))} failed="Couldn't go · try again" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => {
      expect(stores.toasts.getState().toasts).toEqual([
        expect.objectContaining({ kind: 'error', text: "Couldn't go · try again" }),
      ]);
    });
  });

  it('shows nothing when the call succeeds, or has no message', async () => {
    const { stores } = renderApp(
      <>
        <Runner call={() => Promise.resolve()} failed="Couldn't go · try again" />
        <Runner call={() => Promise.reject(new Error('ipc'))} />
      </>,
    );
    for (const button of screen.getAllByRole('button', { name: 'Go' })) {
      await userEvent.click(button);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stores.toasts.getState().toasts).toEqual([]);
  });
});
