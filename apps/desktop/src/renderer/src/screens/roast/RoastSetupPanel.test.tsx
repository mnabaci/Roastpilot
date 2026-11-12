import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoastSummary } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { pick } from '../../test/pick';
import { BEAN } from '../../test/beans';
import { SKYWALKER } from '../../test/roasters';
import { fakeApi, renderApp } from '../../test/render-app';
import {
  auto,
  autoSettings as settings,
  connected,
  onConnect,
  openSetup,
} from '../../test/roast-screen';
import { BUILT_INS as profiles } from '../../test/profiles';
import { RoastScreen } from './RoastScreen';

// The setup card and its profile choice, in Auto (SetupForm, ProfilePicker, PreheatHoldField).
describe('RoastSetupPanel in Auto', () => {
  it('stays Manual with no profile choice until you pick Auto', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, profiles });
    expect(screen.queryByLabelText('Profile')).toBeNull();
    await userEvent.click(screen.getByRole('switch', { name: 'Auto' }));
    expect(api.setSettings).toHaveBeenCalledWith(expect.objectContaining({ roastMode: 'auto' }));
    await openSetup();
    expect(screen.getByLabelText('Profile')).toHaveTextContent('Light · Steps');
    // Said once, by the badge on the setup line, not again under the field.
    expect(screen.getByText('Needs calibration')).toBeInTheDocument();
    expect(screen.queryByText(/stay close/)).toBeNull();
  });

  it('says a profile needs calibration as a badge under the folded setup line', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, auto('ready'));
    const row = screen.getByRole('button', { name: 'Change setup' });
    expect(row).toHaveTextContent(/^Light · StepsNo beanNeeds calibration$/);
    expect(
      within(screen.getByRole('region', { name: 'Setup' })).getByText('Needs calibration'),
    ).toBeInTheDocument();
  });

  it('lists Needs calibration as a badge in the profile picker, the field the name alone', async () => {
    renderApp(<RoastScreen onConnect={onConnect} />, auto('ready'));
    await openSetup();
    const field = screen.getByLabelText('Profile');
    expect(field).toHaveTextContent(/^Light · Steps$/);
    await userEvent.click(field);
    expect(screen.getByRole('option', { name: /^Light · Steps/ })).toHaveTextContent(
      'Light · StepsBuilt-inNeeds calibration',
    );
  });

  it('shows no badge for a calibrated profile', async () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...auto('ready'),
      profiles: profiles.map((e) => ({
        ...e,
        profile: { ...e.profile, needsCalibration: false },
      })),
    });
    expect(screen.queryByText('Needs calibration')).toBeNull();
    await openSetup();
    expect(screen.getByLabelText('Profile')).toHaveTextContent(/^Light · Steps$/);
  });

  it("starts the batch at its stock's next equal batch, around the profile's batch, and warns when far off", async () => {
    const { stores } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...auto('ready'),
      // 5 × 385 g: the profile's batch exactly.
      beans: [{ ...BEAN, greenG: 1925 }],
      roasters: [SKYWALKER],
    });
    await openSetup();
    await pick(screen.getByLabelText('Bean'), /^Yirgacheffe/);
    expect(stores.beans.getState().setup.batchG).toBe(385);
    expect(screen.queryByText(/^Profile tuned for/)).toBeNull();
    const batch = screen.getByLabelText('Batch');
    await userEvent.clear(batch);
    await userEvent.type(batch, '300');
    expect(
      screen.getByText('Profile tuned for 385 g · a 300 g batch runs hotter and faster'),
    ).toBeInTheDocument();
    // A note, not a block: Preheat stays.
    expect(screen.getByRole('button', { name: 'Preheat' })).toBeEnabled();
  });

  it('roasts what is left in one batch when it is less than two', async () => {
    const { stores } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...auto('ready'),
      beans: [{ ...BEAN, greenG: 300 }],
      roasters: [SKYWALKER],
    });
    await openSetup();
    await pick(screen.getByLabelText('Bean'), /^Yirgacheffe/);
    expect(stores.beans.getState().setup.batchG).toBe(300);
  });

  it('labels the suggested profile, says why, and Use this profile picks it', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...auto('ready'),
      settings: { ...settings, autoProfile: 'light-curve' },
      beans: [BEAN],
      setup: { beanId: BEAN.id, batchG: 375, ghostRoastId: null },
      roasters: [SKYWALKER],
    });
    await openSetup();
    const row = screen.getByRole('region', { name: 'Suggested profile' });
    expect(row).toHaveTextContent(
      'Suggested profileLight · Steps' +
        'Use this profile' +
        'The default · star a roast of this bean to improve it',
    );
    // The bean hint says why it speaks.
    expect(
      screen.getByText(
        'Dense beans (830 g/L): these often take heat slowly · consider more heat early',
      ),
    ).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Use this profile' }));
    expect(api.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ autoProfile: 'light-steps' }),
    );
  });

  it('hides the suggestion when it is already the profile picked', async () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...auto('ready'),
      beans: [BEAN],
      setup: { beanId: BEAN.id, batchG: 375, ghostRoastId: null },
      roasters: [SKYWALKER],
    });
    await openSetup();
    expect(screen.queryByRole('region', { name: 'Suggested profile' })).toBeNull();
  });

  describe('preheat hold', () => {
    it("before a preheat shows the first batch's hold; a choice is for this roast only", async () => {
      const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
        ...auto('ready'),
        roasters: [SKYWALKER],
      });
      await openSetup();
      expect(screen.getByText('First batch')).toBeInTheDocument();
      const hold = screen.getByLabelText('Preheat hold');
      expect(hold).toHaveTextContent('2:30');
      await pick(hold, '2:45');
      expect(api.autoSetPreheatHold).toHaveBeenLastCalledWith({ holdS: 165 });
      expect(hold).toHaveTextContent('2:45');
      await pick(hold, '2:30');
      expect(api.autoSetPreheatHold).toHaveBeenLastCalledWith({ holdS: null });
      expect(api.saveRoaster).not.toHaveBeenCalled();
    });

    it("within 20 min of the last roast, picks the next batch's shorter hold", async () => {
      const ended = new Date(Date.now() - 5 * 60_000).toISOString();
      const api = fakeApi({
        listRoasts: vi.fn(() =>
          Promise.resolve([
            {
              id: 9,
              startedAt: ended,
              endedAt: ended,
              dropTimeS: 600,
              roasterId: SKYWALKER.id,
            } as RoastSummary,
          ]),
        ),
      });
      renderApp(
        <RoastScreen onConnect={onConnect} />,
        { ...auto('ready'), roasters: [SKYWALKER] },
        api,
      );
      await openSetup();
      expect(await screen.findByText('Next batch · the drum is still hot')).toBeInTheDocument();
      expect(screen.getByLabelText('Preheat hold')).toHaveTextContent('2:00');
    });

    it('during the preheat shows the hold it runs, and a change goes to the running hold', async () => {
      const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
        ...auto('preheat', {
          preheatStep: 'hold',
          preheatLeftS: 102,
          preheatHold: { s: 120, batch: 'next', chosen: false },
        }),
        roasters: [SKYWALKER],
      });
      expect(screen.getByText('Holding · 1:42 left')).toBeInTheDocument();
      await openSetup();
      expect(screen.getByText('Next batch · the drum is still hot')).toBeInTheDocument();
      const hold = screen.getByLabelText('Preheat hold');
      expect(hold).toHaveTextContent('2:00');
      await pick(hold, '1:45');
      expect(api.autoSetPreheatHold).toHaveBeenLastCalledWith({ holdS: 105 });
    });
  });

  it('picks a profile', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, auto('ready'));
    await openSetup();
    await pick(screen.getByLabelText('Profile'), /^Light · Curve/);
    expect(api.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ autoProfile: 'light-curve' }),
    );
  });

  it.each(['preheat', 'roasting', 'development'] as const)(
    'keeps the profile still in %s, named in the setup line',
    async (phase) => {
      renderApp(<RoastScreen onConnect={onConnect} />, auto(phase));
      await openSetup();
      expect(screen.queryByLabelText('Profile')).toBeNull();
      expect(screen.getByRole('region', { name: 'Setup' })).toHaveTextContent('Light · Steps');
      // The Auto switch itself stays live mid-roast.
      expect(screen.getByRole('switch', { name: 'Auto' })).toBeEnabled();
    },
  );

  it.each(['ready', 'cooling', 'done'] as const)('lets you choose again in %s', async (phase) => {
    renderApp(<RoastScreen onConnect={onConnect} />, auto(phase));
    await openSetup();
    expect(screen.getByLabelText('Profile')).toBeEnabled();
  });
});
