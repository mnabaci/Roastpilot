import { READY_ROAST, type RoastSummary } from '@roastpilot/shared';
import type * as Ui from '@roastpilot/ui';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CONNECTED, fakeApi, renderApp } from '../../test/render-app';
import { RoastScreen } from './RoastScreen';

vi.mock('@roastpilot/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  RoastChart: (await import('../../test/fake-ui')).FakeRoastChart,
}));

const roast = (phase: (typeof READY_ROAST)['phase']) => ({ ...READY_ROAST, phase });
const GHOST: RoastSummary = {
  id: 7,
  startedAt: '2026-11-04T14:32:10.000Z',
  endedAt: '2026-11-04T14:46:00.000Z',
  fcTimeS: 480,
  dropTimeS: 580,
  roasterId: null,
  beanId: null,
  ghostRoastId: null,
  batchG: null,
  roastedG: null,
  rating: null,
  isFavourite: false,
  notes: null,
  profileId: null,
  profileName: null,
  dropTemp: 205.5,
};

/** The panel's parts, top to bottom, by their names. */
const order = () =>
  [...screen.getByRole('complementary', { name: 'Controls' }).children]
    .map(
      (el) =>
        el.getAttribute('aria-label') ??
        (el.querySelector('button')?.textContent ? 'Next action' : el.textContent),
    )
    .filter((name) => name !== '');

describe('Roast side panel follows the roast', () => {
  it('not connected: Connect, then setup, and no outputs', () => {
    renderApp(<RoastScreen onConnect={vi.fn()} />);
    expect(order()).toEqual(['Next action', 'Setup']);
  });

  it('ready: setup, then the next action, then the outputs', () => {
    renderApp(<RoastScreen onConnect={vi.fn()} />, { connection: CONNECTED });
    expect(order()).toEqual(['Setup', 'Next action', 'Outputs']);
  });

  it('roasting: the next action, then the outputs, then the setup as one line', async () => {
    renderApp(
      <RoastScreen onConnect={vi.fn()} />,
      {
        connection: CONNECTED,
        roast: roast('roasting'),
        setup: { beanId: null, batchG: 375, ghostRoastId: GHOST.id },
      },
      fakeApi({ listRoasts: vi.fn(() => Promise.resolve([GHOST])) }),
    );
    expect(order().slice(0, 3)).toEqual(['Next action', 'Outputs', 'Setup']);
    const setup = within(screen.getByRole('region', { name: 'Setup' }));
    expect(await setup.findByText(/No bean · 375 g · ghost/)).toBeInTheDocument();
    expect(setup.queryByLabelText('Bean')).toBeNull();
    expect(setup.queryByLabelText('Ghost')).toBeNull();
  });

  it('mid-roast, Change opens only the ghost', async () => {
    const { api } = renderApp(
      <RoastScreen onConnect={vi.fn()} />,
      { connection: CONNECTED, roast: roast('roasting') },
      fakeApi({ listRoasts: vi.fn(() => Promise.resolve([GHOST])) }),
    );
    const setup = within(screen.getByRole('region', { name: 'Setup' }));
    const change = setup.getByRole('button', { name: 'Change' });
    expect(change).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(change);
    expect(setup.queryByLabelText('Bean')).toBeNull();
    await vi.waitFor(() => {
      expect(setup.getByRole('option', { name: /4 Nov/ })).toBeInTheDocument();
    });
    await userEvent.selectOptions(setup.getByLabelText('Ghost'), String(GHOST.id));
    expect(api.setRoastSetup).toHaveBeenCalledWith(
      expect.objectContaining({ ghostRoastId: GHOST.id }),
    );
  });

  it('done: the controls come first, and Change opens the whole setup for the next roast', async () => {
    renderApp(<RoastScreen onConnect={vi.fn()} />, { connection: CONNECTED, roast: roast('done') });
    expect(order().slice(0, 3)).toEqual(['Next action', 'Outputs', 'Setup']);
    const setup = within(screen.getByRole('region', { name: 'Setup' }));
    expect(setup.queryByLabelText('Bean')).toBeNull();
    await userEvent.click(setup.getByRole('button', { name: 'Change' }));
    expect(setup.getByLabelText('Bean')).toBeInTheDocument();
    expect(setup.getByLabelText('Ghost')).toBeInTheDocument();
  });

  it('ready: the setup starts closed, with its one line', async () => {
    renderApp(<RoastScreen onConnect={vi.fn()} />, { connection: CONNECTED });
    const setup = within(screen.getByRole('region', { name: 'Setup' }));
    expect(setup.getByText('No bean')).toBeInTheDocument();
    expect(setup.queryByLabelText('Bean')).toBeNull();
    await userEvent.click(setup.getByRole('button', { name: 'Change' }));
    expect(setup.getByLabelText('Bean')).toBeInTheDocument();
  });

  it('done: the finished roast shows over the chart, and Done hides it', async () => {
    renderApp(
      <RoastScreen onConnect={vi.fn()} />,
      {
        connection: CONNECTED,
        roast: { ...roast('done'), chargedAtMs: 0 },
        currentRoastId: GHOST.id,
      },
      fakeApi({ listRoasts: vi.fn(() => Promise.resolve([GHOST])) }),
    );
    const card = await screen.findByRole('region', { name: 'Roast just finished' });
    expect(
      within(screen.getByRole('complementary', { name: 'Controls' })).queryByText(
        'Roast just finished',
      ),
    ).toBeNull();
    await userEvent.click(within(card).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('region', { name: 'Roast just finished' })).toBeNull();
  });

  it('connection lost mid-roast: the outputs stay, with dashes', () => {
    renderApp(<RoastScreen onConnect={vi.fn()} />, {
      connection: { status: 'lost', target: { kind: 'simulator' } },
      roast: roast('roasting'),
    });
    expect(screen.getByRole('region', { name: 'Outputs' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Heater' })).toBeDisabled();
  });
});
