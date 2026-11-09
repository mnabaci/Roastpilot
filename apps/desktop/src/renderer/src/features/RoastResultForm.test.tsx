import { err, ok, type RoastSummary } from '@roastpilot/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fakeApi, renderApp } from '../test/render-app';
import { RoastResultForm } from './RoastResultForm';

const ROAST = {
  id: 3,
  batchG: 400,
  roastedG: null,
  rating: null,
  isFavourite: false,
  notes: null,
} as RoastSummary;

describe('RoastResultForm', () => {
  it('saves the roasted weight when you leave the field, and shows the loss', async () => {
    const user = userEvent.setup();
    const { api } = renderApp(<RoastResultForm roast={ROAST} />);
    await user.type(screen.getByLabelText('Roasted'), '340');
    await user.tab();
    await waitFor(() => {
      expect(api.saveRoastResult).toHaveBeenCalledWith({
        id: 3,
        batchG: 400,
        roastedG: 340,
        rating: null,
        isFavourite: false,
        notes: null,
      });
    });
    expect(screen.getByRole('region', { name: 'How it went' })).toHaveTextContent('15.0 % loss');
  });

  it('says Saves as you go, then Saved once a save lands, until the next edit', async () => {
    const user = userEvent.setup();
    renderApp(<RoastResultForm roast={ROAST} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saves as you go');
    await user.click(screen.getByRole('button', { name: '4 stars' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Saved');
    });
    await user.type(screen.getByLabelText('Notes'), 'b');
    expect(screen.getByRole('status')).toHaveTextContent('Saves as you go');
  });

  it('a rating and the star save at once; tapping a rating again clears it', async () => {
    const user = userEvent.setup();
    const { api } = renderApp(<RoastResultForm roast={ROAST} />);
    await user.click(screen.getByRole('button', { name: '4 stars' }));
    expect(api.saveRoastResult).toHaveBeenLastCalledWith(expect.objectContaining({ rating: 4 }));
    await user.click(screen.getByRole('button', { name: '4 stars' }));
    expect(api.saveRoastResult).toHaveBeenLastCalledWith(expect.objectContaining({ rating: null }));
    await user.click(screen.getByRole('button', { name: 'Favourite' }));
    expect(api.saveRoastResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ isFavourite: true }),
    );
  });

  it('does not save a weight that is not one', async () => {
    const user = userEvent.setup();
    const { api } = renderApp(<RoastResultForm roast={ROAST} />);
    await user.type(screen.getByLabelText('Roasted'), 'lots');
    await user.tab();
    expect(api.saveRoastResult).not.toHaveBeenCalled();
  });

  it('a bad weight says so and does not hold up the star, which saves what is saved so far', async () => {
    const user = userEvent.setup();
    const { api } = renderApp(<RoastResultForm roast={ROAST} />);
    await user.type(screen.getByLabelText('Roasted'), 'abc');
    expect(screen.getByText('Enter a weight above 0')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Favourite' }));
    expect(api.saveRoastResult).toHaveBeenCalledWith({
      id: 3,
      batchG: 400,
      roastedG: null,
      rating: null,
      isFavourite: true,
      notes: null,
    });
  });

  it('a refused save shows a toast and says Not saved until a save lands', async () => {
    const user = userEvent.setup();
    const failed = err({ kind: 'storage-failed' as const, message: 'x' });
    const api = fakeApi({ saveRoastResult: vi.fn(() => Promise.resolve(failed)) });
    const { stores } = renderApp(<RoastResultForm roast={ROAST} />, {}, api);
    await user.click(screen.getByRole('button', { name: '5 stars' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Not saved · try again');
    });
    expect(stores.toasts.getState().toasts).toEqual([
      expect.objectContaining({ kind: 'error', text: "Couldn't save how it went · try again" }),
    ]);
    // Typing doesn't hide it; the next save that lands does.
    await user.type(screen.getByLabelText('Notes'), 'b');
    expect(screen.getByRole('status')).toHaveTextContent('Not saved · try again');
    api.saveRoastResult.mockResolvedValue(ok(undefined));
    await user.click(screen.getByRole('button', { name: '4 stars' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Saved');
    });
  });

  it('a save that never reaches main shows the toast and Not saved too', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ saveRoastResult: vi.fn(() => Promise.reject(new Error('ipc'))) });
    const { stores } = renderApp(<RoastResultForm roast={ROAST} />, {}, api);
    await user.click(screen.getByRole('button', { name: '5 stars' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Not saved · try again');
    });
    await waitFor(() => {
      expect(stores.toasts.getState().toasts.map((t) => t.text)).toEqual([
        "Couldn't save how it went · try again",
      ]);
    });
  });

  it('says roasted can not outweigh green, and saves nothing until it is fixed', async () => {
    const user = userEvent.setup();
    const { api } = renderApp(<RoastResultForm roast={ROAST} />);
    await user.type(screen.getByLabelText('Roasted'), '450');
    await user.tab();
    expect(screen.getByText("Roasted can't be more than green")).toBeTruthy();
    expect(api.saveRoastResult).not.toHaveBeenCalled();
  });
});
