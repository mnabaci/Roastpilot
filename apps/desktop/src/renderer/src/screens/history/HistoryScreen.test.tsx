import {
  err,
  ok,
  type RoastDetail,
  type RoastId,
  type RoastPhase,
  type RoastSummary,
} from '@roastpilot/shared';
import type * as Ui from '@roastpilot/ui';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { READY_ROAST } from '../../stores/roast-store';
import { fakeApi, renderApp } from '../../test/render-app';
import { HistoryScreen } from './HistoryScreen';

vi.mock('@roastpilot/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  RoastChart: (await import('../../test/fake-ui')).FakeRoastChart,
}));

const summary = (id: number, startedAt: string, over: Partial<RoastSummary> = {}) => ({
  id,
  startedAt,
  endedAt: startedAt,
  fcTimeS: 480,
  dropTimeS: 580,
  dropTemp: 205.5,
  ...over,
});
const NEWER = summary(2, '2026-11-04T14:32:00.000Z');
const OLDER = summary(1, '2026-11-02T18:20:00.000Z', { fcTimeS: null, endedAt: null });
const detail = (s: RoastSummary): RoastDetail => ({
  ...s,
  samples: [{ tS: 0, values: { bt: 180 } }],
  events: [{ kind: 'charge', tS: 0, bt: 180 }],
});

function renderWithPhase(roasts: RoastSummary[], phase: RoastPhase) {
  const api = fakeApi({ listRoasts: vi.fn(() => Promise.resolve(roasts)) });
  renderApp(<HistoryScreen />, { roast: { ...READY_ROAST, phase } }, api);
}

function setup(roasts: RoastSummary[] = [NEWER, OLDER]) {
  const listeners = new Set<(change: { id: RoastId }) => void>();
  let list = roasts;
  const api = fakeApi({
    listRoasts: vi.fn(() => Promise.resolve(list)),
    getRoast: vi.fn((id: RoastId) => {
      const found = list.find((r) => r.id === id);
      return Promise.resolve(found ? ok(detail(found)) : err({ kind: 'not-found' as const, id }));
    }),
    deleteRoast: vi.fn((id: RoastId) => {
      list = list.filter((r) => r.id !== id);
      return Promise.resolve(ok(undefined));
    }),
    onRoastsChanged: vi.fn((listener: (change: { id: RoastId }) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  });
  renderApp(<HistoryScreen />, {}, api);
  return {
    api,
    save: (roast: RoastSummary) => {
      list = [roast, ...list];
      act(() => {
        for (const listener of listeners) listener({ id: roast.id });
      });
    },
  };
}

/** The `i`th element, failing the test when there are fewer. */
function nth(elements: HTMLElement[], i: number): HTMLElement {
  const element = elements[i];
  if (!element) throw new Error(`expected at least ${String(i + 1)} elements`);
  return element;
}

const chartLayers = () => screen.getByRole('region', { name: 'Roast curve' }).dataset.layers;

describe('HistoryScreen', () => {
  it('says how roasts get here when there are none', async () => {
    setup([]);
    expect(await screen.findByText(/No roasts yet/)).toBeInTheDocument();
  });

  it('lists roasts newest first and opens the newest, with its numbers and chart', async () => {
    setup();
    const rows = await screen.findAllByRole('button', { name: /Nov/ });
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
    expect(rows[1]).toHaveTextContent('Unfinished');
    expect(await screen.findByRole('region', { name: 'Roast curve' })).toBeInTheDocument();
    expect(screen.getByText('9:40', { selector: '*' })).toBeInTheDocument();
  });

  it('opens a roast when picked', async () => {
    const { api } = setup();
    await userEvent.click(nth(await screen.findAllByRole('button', { name: /Nov/ }), 1));
    expect(api.getRoast).toHaveBeenLastCalledWith(1);
  });

  it('Compare with draws the other roast as a ghost line', async () => {
    setup();
    await screen.findByRole('region', { name: 'Roast curve' });
    expect(chartLayers()).not.toContain('compare-bt');
    const compare = screen.getByRole('combobox', { name: 'Compare with' });
    await userEvent.selectOptions(compare, '1');
    await vi.waitFor(() => {
      expect(chartLayers()).toContain('compare-bt');
    });
  });

  it('Delete asks once, then removes the roast and opens the next', async () => {
    const { api } = setup();
    await screen.findByRole('region', { name: 'Roast curve' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = screen.getByRole('group', { name: /Delete this roast\?/ });
    expect(confirm).toHaveTextContent("can't be undone");
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.deleteRoast).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(nth(screen.getAllByRole('button', { name: 'Delete' }), 0));
    expect(api.deleteRoast).toHaveBeenCalledWith(2);
    await vi.waitFor(() => {
      expect(api.getRoast).toHaveBeenLastCalledWith(1);
    });
  });

  it('says so when a delete fails', async () => {
    const { api } = setup();
    api.deleteRoast.mockResolvedValue(err({ kind: 'storage-failed', message: 'locked' }));
    await screen.findByRole('region', { name: 'Roast curve' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(nth(screen.getAllByRole('button', { name: 'Delete' }), 0));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't delete");
  });

  it('says so when a roast cannot be opened', async () => {
    const { api } = setup();
    api.getRoast.mockResolvedValue(err({ kind: 'storage-failed', message: 'locked' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't open this roast");
  });

  it('a newly saved roast appears on top', async () => {
    const { save } = setup();
    await screen.findAllByRole('button', { name: /Nov/ });
    save(summary(3, '2026-11-05T08:00:00.000Z'));
    await vi.waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Nov/ })).toHaveLength(3);
    });
  });

  it('the roast being roasted has no Delete, only a note that it is saving', async () => {
    const live = summary(3, '2026-11-05T08:00:00.000Z', { endedAt: null });
    renderWithPhase([live, NEWER], 'roasting');
    expect(await screen.findByText('Saving as it roasts')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
