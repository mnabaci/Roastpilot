import {
  AUTO_OFF,
  DEFAULT_SETTINGS,
  err,
  ok,
  READY_ROAST,
  type AutoProfile,
} from '@roastpilot/shared';
import type * as Ui from '@roastpilot/ui';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BUILT_INS, CURVE, STEPS } from '../../test/profiles';
import { fakeApi, renderApp } from '../../test/render-app';
import { roastersWith } from '../../test/roasters';
import { ProfilesScreen } from './ProfilesScreen';

vi.mock('@roastpilot/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  RoastChart: (await import('../../test/fake-ui')).FakeRoastChart,
}));

const MINE: AutoProfile = { ...STEPS, id: 'custom-1', name: 'Mine' };
const OWN = { profile: MINE, builtIn: false };
const withMine = [...BUILT_INS, OWN];
const settingsOn = (autoProfile: string) => ({ settings: { ...DEFAULT_SETTINGS, autoProfile } });
const open = (api = fakeApi(), profiles = withMine, id = 'custom-1') =>
  renderApp(<ProfilesScreen />, { profiles, ...settingsOn(id) }, api);
const edit = async (name: string, text: string) => {
  const field = screen.getByRole('textbox', { name });
  await userEvent.clear(field);
  await userEvent.type(field, text);
};

describe('ProfilesScreen', () => {
  it('opens the profile Auto uses, and lists the rest', () => {
    open();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Mine');
    expect(screen.getByText('Auto uses this')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Light · Curve' })).toBeInTheDocument();
  });

  it('a built-in cannot be edited, only duplicated', async () => {
    const api = fakeApi({
      duplicateProfile: vi.fn(() => Promise.resolve(ok(OWN))),
      listProfiles: vi.fn(() => Promise.resolve(withMine)),
    });
    open(api, BUILT_INS, 'light-steps');
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'BT cap' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(api.duplicateProfile).toHaveBeenCalledWith('light-steps');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Mine');
    });
  });

  it('Use for Auto saves the choice', async () => {
    const { api } = open(fakeApi(), withMine, 'light-steps');
    await userEvent.click(screen.getByRole('button', { name: 'Mine' }));
    await userEvent.click(screen.getByRole('button', { name: 'Use for Auto' }));
    expect(api.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ autoProfile: 'custom-1' }),
    );
  });

  it('saves your edit, and shows Save and Discard only while there is one', async () => {
    const api = fakeApi({ listProfiles: vi.fn(() => Promise.resolve(withMine)) });
    open(api);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    await edit('BT cap', '205');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.saveProfile).toHaveBeenCalledWith(expect.objectContaining({ capC: 205 }));
  });

  it('holds Save back and says why while a cell has a problem', async () => {
    const { api } = open();
    await edit('BT cap', '300');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'BT cap' })).toBeInvalid();
    expect(screen.getByText('At most 235 °C')).toBeInTheDocument();
    expect(api.saveProfile).not.toHaveBeenCalled();
  });

  it('says what is wrong with a step on its own line', async () => {
    open();
    await edit('Heat on end temperature', 'x');
    expect(screen.getByRole('alert')).toHaveTextContent('Heat on: Enter a number');
  });

  it('Discard goes back to what is saved', async () => {
    open();
    await edit('BT cap', '205');
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('textbox', { name: 'BT cap' })).toHaveValue('200');
  });

  it('keeps an unsaved edit while you look at another profile', async () => {
    open();
    await edit('BT cap', '205');
    await userEvent.click(screen.getByRole('button', { name: 'Light · Steps' }));
    expect(screen.getByRole('textbox', { name: 'BT cap' })).toHaveValue('200');
    await userEvent.click(screen.getByRole('button', { name: /Mine/ }));
    expect(screen.getByRole('textbox', { name: 'BT cap' })).toHaveValue('205');
  });

  it('adds and removes steps', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Add step' }));
    expect(screen.getByRole('textbox', { name: 'Step 2 name' })).toHaveValue('New step');
    await userEvent.click(screen.getByRole('button', { name: 'Remove New step' }));
    expect(screen.getByRole('textbox', { name: 'Step 2 name' })).toHaveValue('Development');
    expect(screen.queryByRole('button', { name: 'Remove Development' })).toBeNull();
  });

  it('a curve profile has curve points and no durations', () => {
    const curve = { profile: { ...CURVE, id: 'custom-c', name: 'My curve' }, builtIn: false };
    open(fakeApi(), [...BUILT_INS, curve], 'custom-c');
    expect(screen.getByRole('heading', { name: 'Curve points' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'RoR min' })).toBeNull();
  });

  it('asks once before deleting, then goes back to the one Auto uses', async () => {
    const api = fakeApi({ listProfiles: vi.fn(() => Promise.resolve(BUILT_INS)) });
    open(api);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteProfile).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteProfile).toHaveBeenCalledWith('custom-1');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Light · Steps');
    });
  });

  it('says so when storage refuses, and keeps your edit', async () => {
    const api = fakeApi({
      saveProfile: vi.fn(() =>
        Promise.resolve(err({ kind: 'storage-failed' as const, message: 'Disk full' })),
      ),
    });
    open(api);
    await edit('BT cap', '205');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Disk full');
    expect(screen.getByRole('textbox', { name: 'BT cap' })).toHaveValue('205');
  });

  describe('while Auto runs a profile', () => {
    const running = {
      auto: { ...AUTO_OFF, enabled: true },
      roast: { ...READY_ROAST, phase: 'roasting' as const },
    };
    const openRunning = (id: string) =>
      renderApp(<ProfilesScreen />, { profiles: withMine, ...settingsOn(id), ...running });

    it('holds Save and Delete for the one it runs, and keeps your edit', async () => {
      openRunning('custom-1');
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
      await edit('BT cap', '205');
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'BT cap' })).toHaveValue('205');
    });

    it('holds Use for Auto, but other profiles can still be saved', async () => {
      openRunning('light-steps');
      await userEvent.click(screen.getByRole('button', { name: 'Mine' }));
      expect(screen.getByRole('button', { name: 'Use for Auto' })).toBeDisabled();
      await edit('BT cap', '205');
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });
  });

  it('copies to another roaster and says so', async () => {
    const api = fakeApi({ copyProfile: vi.fn(() => Promise.resolve(ok(OWN))) });
    renderApp(
      <ProfilesScreen />,
      { profiles: withMine, ...settingsOn('light-steps'), roasters: roastersWith(null) },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copy to Simulator' }));
    expect(api.copyProfile).toHaveBeenCalledWith({ id: 'light-steps', roasterId: 2 });
    const message = await screen.findByText(/needs calibration there/);
    // Beside the Name field, the buttons' box must not grow with the message.
    const buttons = screen.getByRole('button', { name: 'Copy to Simulator' }).parentElement;
    expect(buttons).not.toContainElement(message);
    expect(screen.getByText('Built-in').closest('p')).toContainElement(message);
  });
});
