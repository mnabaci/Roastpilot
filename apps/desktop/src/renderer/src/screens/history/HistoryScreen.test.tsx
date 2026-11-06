import {
  err,
  ok,
  type RoastDetail,
  type RoastId,
  type RoastPhase,
  type RoastSummary,
} from '@roastpilot/shared';
import type * as Ui from '@roastpilot/ui';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { READY_ROAST } from '@roastpilot/shared';
import { BEAN } from '../../test/beans';
import { STEPS } from '../../test/profiles';
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
  imported: false,
  dropTemp: 205.5,
  ...over,
});
const NEWER = summary(2, '2026-11-04T14:32:00.000Z');
const OLDER = summary(1, '2026-11-02T18:20:00.000Z', { fcTimeS: null, endedAt: null });
const detail = (s: RoastSummary): RoastDetail => ({
  ...s,
  mode: 'manual',
  profile: null,
  samples: [{ tS: 0, values: { bt: 180 } }],
  events: [{ kind: 'charge', tS: 0, bt: 180 }],
});

function renderWithPhase(roasts: RoastSummary[], phase: RoastPhase) {
  const api = fakeApi({ listRoasts: vi.fn(() => Promise.resolve(roasts)) });
  renderApp(
    <HistoryScreen onOpenProfile={() => undefined} />,
    { roast: { ...READY_ROAST, phase } },
    api,
  );
}

function setup(roasts: RoastSummary[] = [NEWER, OLDER]) {
  const listeners = new Set<(change: { id: RoastId; deleted: boolean }) => void>();
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
    onRoastsChanged: vi.fn((listener: (change: { id: RoastId; deleted: boolean }) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  });
  renderApp(<HistoryScreen onOpenProfile={() => undefined} />, {}, api);
  return {
    api,
    save: (roast: RoastSummary) => {
      list = [roast, ...list];
      act(() => {
        for (const listener of listeners) listener({ id: roast.id, deleted: false });
      });
    },
    deleted: (id: RoastId) => {
      act(() => {
        for (const listener of listeners) listener({ id, deleted: true });
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

/** A profile of your own, as Make profile returns it. */
const OWN = { profile: { ...STEPS, id: 'made-1', name: 'From a roast' }, builtIn: false };

/** Opens the ⋯ menu of the roast on the right and picks Delete. */
async function pickDelete() {
  await userEvent.click(screen.getByRole('button', { name: 'More for this roast' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
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
    const events = screen.getByRole('table', { name: 'Events' });
    expect(within(events).getByRole('row', { name: /Charge/ })).toHaveTextContent('180.0 °C');
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
    const compare = screen.getByRole('combobox', { name: 'Compare' });
    await userEvent.selectOptions(compare, '1');
    await vi.waitFor(() => {
      expect(chartLayers()).toContain('compare-bt');
    });
  });

  it('Delete asks once, then removes the roast and opens the next', async () => {
    const { api } = setup();
    await screen.findByRole('region', { name: 'Roast curve' });
    await pickDelete();
    const confirm = screen.getByRole('alertdialog', { name: 'Delete this roast?' });
    expect(confirm).toHaveAccessibleDescription("can't be undone");
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(api.deleteRoast).not.toHaveBeenCalled();

    await pickDelete();
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(api.deleteRoast).toHaveBeenCalledWith(2);
    await vi.waitFor(() => {
      expect(api.getRoast).toHaveBeenLastCalledWith(1);
    });
  });

  it('says so when a delete fails', async () => {
    const { api } = setup();
    api.deleteRoast.mockResolvedValue(err({ kind: 'storage-failed', message: 'locked' }));
    await screen.findByRole('region', { name: 'Roast curve' });
    await pickDelete();
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
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
    expect(screen.queryByRole('button', { name: 'More for this roast' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make profile' })).toBeNull();
  });

  it('does not read a roast again once it is deleted', async () => {
    const { api, deleted } = setup();
    await vi.waitFor(() => {
      expect(api.getRoast).toHaveBeenCalledWith(NEWER.id);
    });
    const reads = api.getRoast.mock.calls.length;
    deleted(NEWER.id);
    expect(api.getRoast).toHaveBeenCalledTimes(reads);
  });

  it('filters to favourites, and says when nothing matches', async () => {
    const user = userEvent.setup();
    const api = fakeApi({
      listRoasts: vi.fn(() => Promise.resolve([summary(1, '2026-11-04T10:00:00.000Z')])),
    });
    renderApp(<HistoryScreen onOpenProfile={() => undefined} />, {}, api);
    await user.click(await screen.findByRole('button', { name: 'Favourites only' }));
    expect(screen.getByText('No roasts match these filters')).toBeTruthy();
  });

  it('Make profile offers step and curve, then opens the new profile', async () => {
    const opened = vi.fn();
    const api = fakeApi({
      listRoasts: vi.fn(() => Promise.resolve([NEWER])),
      getRoast: vi.fn(() => Promise.resolve(ok(detail(NEWER)))),
      makeProfileFromRoast: vi.fn(() => Promise.resolve(ok(OWN))),
      listProfiles: vi.fn(() => Promise.resolve([OWN])),
    });
    renderApp(<HistoryScreen onOpenProfile={opened} />, {}, api);
    await screen.findByRole('region', { name: 'Roast curve' });
    await userEvent.click(screen.getByRole('button', { name: 'Make profile' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Curve profile' }));
    expect(api.makeProfileFromRoast).toHaveBeenCalledWith({ roastId: NEWER.id, style: 'curve' });
    await vi.waitFor(() => {
      expect(opened).toHaveBeenCalledWith(OWN.profile.id);
    });
  });

  it('says why a roast is too short to make a profile from', async () => {
    const api = fakeApi({
      listRoasts: vi.fn(() => Promise.resolve([NEWER])),
      getRoast: vi.fn(() => Promise.resolve(ok(detail(NEWER)))),
      makeProfileFromRoast: vi.fn(() => Promise.resolve(err({ kind: 'too-short' as const }))),
    });
    renderApp(<HistoryScreen onOpenProfile={vi.fn()} />, {}, api);
    await screen.findByRole('region', { name: 'Roast curve' });
    await userEvent.click(screen.getByRole('button', { name: 'Make profile' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Step profile' }));
    expect(await screen.findByText(/Too little to go on/)).toBeInTheDocument();
  });

  it('exports all and imports from the ⋯ beside the title, saying how it went', async () => {
    const { api } = setup();
    api.exportRoasts.mockResolvedValue(ok({ status: 'saved' as const, fileName: 'roasts.json' }));
    api.importRoasts.mockResolvedValue(ok({ status: 'imported' as const, added: 12, skipped: 3 }));
    api.importArtisan.mockResolvedValue(err({ kind: 'not-artisan' as const }));
    await screen.findByRole('region', { name: 'Roast curve' });
    const pick = async (item: string) => {
      await userEvent.click(screen.getByRole('button', { name: 'More for History' }));
      await userEvent.click(screen.getByRole('menuitem', { name: item }));
    };
    await pick('Export all · Roastpilot file');
    expect(api.exportRoasts).toHaveBeenLastCalledWith({ format: 'roastpilot' });
    expect(await screen.findByText('Saved roasts.json')).toBeInTheDocument();
    await pick('Export all · CSV');
    expect(api.exportRoasts).toHaveBeenLastCalledWith({ format: 'csv' });
    await pick('Import a Roastpilot file');
    expect(await screen.findByText('Imported 12 roasts · 3 were already here')).toBeInTheDocument();
    await pick('Import from Artisan');
    expect(await screen.findByRole('alert')).toHaveTextContent("isn't an Artisan roast");
  });

  it('Select ticks roasts, Shift ticks a range, and exports just those', async () => {
    const { api } = setup([NEWER, OLDER, summary(3, '2026-11-01T08:00:00.000Z')]);
    await screen.findByRole('region', { name: 'Roast curve' });
    await userEvent.click(screen.getByRole('button', { name: 'More for History' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Select' }));
    const user = userEvent.setup();
    const boxes = screen.getAllByRole('checkbox');
    await user.click(nth(boxes, 0));
    await user.keyboard('{Shift>}');
    await user.click(nth(boxes, 2));
    await user.keyboard('{/Shift}');
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('menuitem', { name: 'CSV' }));
    expect(api.exportRoasts).toHaveBeenCalledWith({ format: 'csv', ids: [2, 1, 3] });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('exports the open roast from its ⋯', async () => {
    const { api } = setup();
    await screen.findByRole('region', { name: 'Roast curve' });
    await userEvent.click(screen.getByRole('button', { name: 'More for this roast' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Export · Roastpilot file' }));
    expect(api.exportRoasts).toHaveBeenCalledWith({ format: 'roastpilot', ids: [NEWER.id] });
  });

  it('links the open roast to a bean', async () => {
    const api = fakeApi({
      listRoasts: vi.fn(() => Promise.resolve([NEWER])),
      getRoast: vi.fn(() => Promise.resolve(ok(detail(NEWER)))),
    });
    renderApp(
      <HistoryScreen onOpenProfile={vi.fn()} />,
      { beans: [{ ...BEAN, id: 4, name: 'Ethiopia Guji' }] },
      api,
    );
    await screen.findByRole('region', { name: 'Roast curve' });
    const roast = within(screen.getByRole('region', { name: 'Roast' }));
    await userEvent.selectOptions(roast.getByRole('combobox', { name: 'Bean' }), '4');
    expect(api.setRoastBean).toHaveBeenCalledWith({ id: NEWER.id, beanId: 4 });
  });
});
