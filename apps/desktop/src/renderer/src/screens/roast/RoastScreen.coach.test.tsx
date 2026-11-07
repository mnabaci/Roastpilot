import { err, READY_ROAST, type CoachStatus } from '@roastpilot/shared';
import type * as Ui from '@roastpilot/ui';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CONNECTED, fakeApi, renderApp } from '../../test/render-app';
import { RoastScreen } from './RoastScreen';

vi.mock('@roastpilot/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  RoastChart: (await import('../../test/fake-ui')).FakeRoastChart,
}));

const roasting = { ...READY_ROAST, phase: 'roasting' as const, chargedAtMs: 0 };
const SUGGESTION: CoachStatus = {
  advice: {
    kind: 'setting',
    id: 7,
    heater: { from: 65, to: 75 },
    fan: { from: 50, to: 40 },
    reason: '4 °C below target, RoR falling',
  },
  needsCalibration: null,
};

const show = (coach: CoachStatus, api = fakeApi()) =>
  renderApp(
    <RoastScreen onConnect={() => undefined} />,
    {
      connection: CONNECTED,
      roast: roasting,
      coach,
    },
    api,
  );

const toastTexts = (stores: ReturnType<typeof show>['stores']) =>
  stores.toasts.getState().toasts.map((t) => t.text);

describe('RoastScreen coach card', () => {
  it('sits above the outputs with the change, the reason and Apply', () => {
    show(SUGGESTION);
    const controls = screen.getByRole('complementary', { name: 'Controls' });
    const regions = within(controls)
      .getAllByRole('region')
      .map((r) => r.getAttribute('aria-label'));
    expect(regions.indexOf('Coach suggestion')).toBeLessThan(regions.indexOf('Outputs'));
    const card = screen.getByRole('region', { name: 'Coach suggestion' });
    expect(within(card).getByText('Heater 65% → 75%')).toBeInTheDocument();
    expect(within(card).getByText('Fan 50% → 40%')).toBeInTheDocument();
    expect(card).toHaveTextContent('4 °C below target, RoR falling');
  });

  it('names a profile that needs calibration after the label', () => {
    show({ ...SUGGESTION, needsCalibration: 'Light · Steps' });
    expect(screen.getByRole('region', { name: 'Coach suggestion' })).toHaveTextContent(
      'Coach suggests · needs calibration',
    );
  });

  it('is not there when main has nothing to say', () => {
    show({ advice: null, needsCalibration: null });
    expect(screen.queryByRole('region', { name: 'Coach suggestion' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Coach heads-up' })).toBeNull();
  });

  it('Apply and Dismiss name the card you saw', async () => {
    const { api } = show(SUGGESTION);
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(api.coachApply).toHaveBeenCalledWith({ id: 7 });
    expect(api.coachDismiss).toHaveBeenCalledWith({ id: 7 });
  });

  it('sends Apply once while its call is on its way, then lets it be pressed again', async () => {
    type Applied = Awaited<ReturnType<ReturnType<typeof fakeApi>['coachApply']>>;
    let land: (value: Applied) => void = () => undefined;
    const api = fakeApi({
      coachApply: vi.fn(
        () =>
          new Promise<Applied>((resolve) => {
            land = resolve;
          }),
      ),
    });
    show(SUGGESTION, api);
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    const busy = screen.getByRole('button', { name: 'Applying…' });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(api.coachApply).toHaveBeenCalledOnce();
    land(err({ kind: 'stale' as const }));
    expect(await screen.findByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('a double click in one go still sends Apply once', () => {
    const api = fakeApi({ coachApply: vi.fn(() => new Promise<never>(() => undefined)) });
    show(SUGGESTION, api);
    const apply = screen.getByRole('button', { name: 'Apply' });
    act(() => {
      fireEvent.click(apply);
      fireEvent.click(apply);
    });
    expect(api.coachApply).toHaveBeenCalledOnce();
  });

  it('says so when the card changed before Apply landed', async () => {
    const api = fakeApi({
      coachApply: vi.fn(() => Promise.resolve(err({ kind: 'stale' as const }))),
    });
    const { stores } = show(SUGGESTION, api);
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(toastTexts(stores)).toEqual(['The suggestion changed · check the card']);
    });
  });

  it('leaves a safety refusal to its banner', async () => {
    const api = fakeApi({
      coachApply: vi.fn(() =>
        Promise.resolve(err({ kind: 'safety-locked' as const, channel: 'heater' })),
      ),
    });
    const { stores } = show(SUGGESTION, api);
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(api.coachApply).toHaveBeenCalled();
    });
    expect(toastTexts(stores)).toEqual([]);
  });

  it('asks to try again when Apply or Dismiss fails', async () => {
    const api = fakeApi({
      coachApply: vi.fn(() => Promise.reject(new Error('ipc'))),
      coachDismiss: vi.fn(() => Promise.reject(new Error('ipc'))),
    });
    const { stores } = show(SUGGESTION, api);
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(toastTexts(stores)).toEqual([
        "Couldn't apply the suggestion · try again",
        "Couldn't dismiss · try again",
      ]);
    });
  });

  it('a heads-up has its line and Dismiss only, with the calibration note', async () => {
    const { api } = show({
      advice: { kind: 'first-crack-soon', id: 3, inS: 45 },
      needsCalibration: 'Light · Steps',
    });
    const card = screen.getByRole('region', { name: 'Coach heads-up' });
    expect(card).toHaveTextContent('Heads-up · needs calibration');
    expect(card).toHaveTextContent('First crack in ~45 s · listen');
    expect(within(card).queryByRole('button', { name: 'Apply' })).toBeNull();
    await userEvent.click(within(card).getByRole('button', { name: 'Dismiss' }));
    expect(api.coachDismiss).toHaveBeenCalledWith({ id: 3 });
  });
});
