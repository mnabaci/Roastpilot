import type { RoastSummary } from '@roastpilot/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BEAN } from '../../test/beans';
import { ACCEPTED_SETTINGS, renderApp } from '../../test/render-app';
import { RoastDetailsCard } from './RoastDetailsCard';

const roast = (id: number, over: Partial<RoastSummary> = {}): RoastSummary => ({
  id,
  startedAt: '2026-11-04T14:32:00.000Z',
  endedAt: '2026-11-04T14:50:00.000Z',
  fcTimeS: 480,
  fcTemp: null,
  dropTimeS: 580,
  dropTemp: 205.5,
  roasterId: null,
  beanId: BEAN.id,
  ghostRoastId: null,
  batchG: 356,
  roastedG: 305,
  rating: 5,
  isFavourite: false,
  notes: 'Third auto roast curve',
  profileId: null,
  profileName: null,
  imported: false,
  ...over,
});

describe('RoastDetailsCard', () => {
  it('opens by default with the bean, weights, rating and notes', () => {
    renderApp(<RoastDetailsCard roast={roast(1)} beans={[BEAN]} live={false} />);
    expect(screen.getByRole('button', { name: 'Roast details' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Bean/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Green')).toHaveValue('356');
    expect(screen.getByRole('group', { name: 'Rating' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Third auto roast curve');
  });

  it('folds to one line, and saves that choice for every roast', async () => {
    const { api, stores } = renderApp(
      <RoastDetailsCard roast={roast(1)} beans={[BEAN]} live={false} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Roast details' }));
    const header = screen.getByRole('button', { name: 'Roast details' });
    expect(header).toHaveTextContent(
      `${BEAN.name} · 356 → 305 g · 14.3 % · ★★★★★ · Third auto roast curve`,
    );
    expect(header).toHaveAccessibleDescription(
      `${BEAN.name} · 356 → 305 g · 14.3 % · rated 5 of 5 · Third auto roast curve`,
    );
    expect(screen.queryByLabelText('Notes')).toBeNull();
    await waitFor(() => {
      expect(api.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({ historyDetailsOpen: false }),
      );
    });
    // One setting, not per roast: every roast opens folded now.
    expect(stores.settings.getState().settings.historyDetailsOpen).toBe(false);
  });

  it('opens folded when the setting says so, as after a restart', () => {
    renderApp(<RoastDetailsCard roast={roast(1)} beans={[BEAN]} live={false} />, {
      settings: { ...ACCEPTED_SETTINGS, historyDetailsOpen: false },
    });
    expect(screen.getByRole('button', { name: 'Roast details' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('leaves the bean alone on the roast being roasted', () => {
    renderApp(<RoastDetailsCard roast={roast(1)} beans={[BEAN]} live />);
    expect(screen.queryByRole('button', { name: /^Bean/ })).toBeNull();
    expect(screen.getByLabelText('Green')).toBeInTheDocument();
  });
});
