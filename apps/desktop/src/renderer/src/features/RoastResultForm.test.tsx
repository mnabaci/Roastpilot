import { err, type RoastSummary } from '@roastpilot/shared';
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
    expect(screen.getByText('15.0% weight loss')).toBeTruthy();
  });

  it('says Saves as you go, then Saved once a save lands, until the next edit', async () => {
    const user = userEvent.setup();
    renderApp(<RoastResultForm roast={ROAST} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saves as you go');
    await user.click(screen.getByRole('button', { name: '4' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Saved');
    });
    await user.type(screen.getByLabelText('Notes'), 'b');
    expect(screen.getByRole('status')).toHaveTextContent('Saves as you go');
  });

  it('a rating and the star save at once; tapping a rating again clears it', async () => {
    const user = userEvent.setup();
    const { api } = renderApp(<RoastResultForm roast={ROAST} />);
    await user.click(screen.getByRole('button', { name: '4' }));
    expect(api.saveRoastResult).toHaveBeenLastCalledWith(expect.objectContaining({ rating: 4 }));
    await user.click(screen.getByRole('button', { name: '4' }));
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
    expect(screen.getByText('Enter a weight')).toBeTruthy();
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

  it('says when it could not save', async () => {
    const user = userEvent.setup();
    const failed = err({ kind: 'storage-failed' as const, message: 'x' });
    const api = fakeApi({ saveRoastResult: vi.fn(() => Promise.resolve(failed)) });
    renderApp(<RoastResultForm roast={ROAST} />, {}, api);
    await user.click(screen.getByRole('button', { name: '5' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
