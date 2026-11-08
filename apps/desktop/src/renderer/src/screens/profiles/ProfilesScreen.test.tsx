import {
  AUTO_OFF,
  DEFAULT_SETTINGS,
  err,
  ok,
  READY_ROAST,
  type AutoProfile,
} from '@roastpilot/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BUILT_INS, CURVE, STEPS } from '../../test/profiles';
import { fakeApi, renderApp } from '../../test/render-app';
import { roastersWith } from '../../test/roasters';
import { ProfilesScreen } from './ProfilesScreen';

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
    // Auto's profile shows its badge in the header and in the list.
    const header = within(screen.getByRole('banner'));
    expect(header.getByText('Auto')).toBeInTheDocument();
    expect(header.queryByRole('button', { name: 'Use for Auto' })).toBeNull();
    const list = within(screen.getByRole('list', { name: 'Profiles' }));
    expect(list.getByRole('button', { name: /Mine/ })).toHaveTextContent('Auto');
    expect(list.getByRole('button', { name: 'Light · Curve' })).toBeInTheDocument();
  });

  it('a built-in cannot be edited, only duplicated', async () => {
    const api = fakeApi({
      duplicateProfile: vi.fn(() => Promise.resolve(ok(OWN))),
      listProfiles: vi.fn(() => Promise.resolve(withMine)),
    });
    open(api, BUILT_INS, 'light-steps');
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'BT cap' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /^More for (?!Profiles$)/ }));
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
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

  it("says what is wrong with the soak's fan", async () => {
    open();
    await edit('Soak fan', '120');
    expect(screen.getByRole('alert')).toHaveTextContent(/^Soak: /);
  });

  describe('the soak', () => {
    const pick = async (option: string) => {
      await userEvent.click(screen.getByRole('button', { name: 'Soak length' }));
      await userEvent.click(screen.getByRole('option', { name: option }));
    };

    it('sets its length from a list, and saves it', async () => {
      const api = fakeApi({ listProfiles: vi.fn(() => Promise.resolve(withMine)) });
      open(api);
      expect(screen.getByRole('button', { name: 'Soak length' })).toHaveTextContent('1:00');
      await pick('1:30');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      const saved = vi.mocked(api.saveProfile).mock.calls[0]?.[0];
      expect(saved?.phases[0]?.next).toEqual({ on: 'time', afterS: 90 });
    });

    it('Off keeps the row but greys its fan, and saves a profile without one', async () => {
      const api = fakeApi({ listProfiles: vi.fn(() => Promise.resolve(withMine)) });
      open(api);
      await pick('Off');
      expect(screen.getByRole('textbox', { name: 'Soak fan' })).toBeDisabled();
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      const saved = vi.mocked(api.saveProfile).mock.calls[0]?.[0];
      expect(saved?.phases.map((p) => p.name)).toEqual(['Heat on', 'Development']);
    });

    it('comes back with its fan when you pick a length again', async () => {
      open();
      await edit('Soak fan', '40');
      await pick('Off');
      await pick('0:45');
      expect(screen.getByRole('textbox', { name: 'Soak fan' })).toBeEnabled();
      expect(screen.getByRole('textbox', { name: 'Soak fan' })).toHaveValue('40');
    });

    it('a built-in shows its length as text', () => {
      open(fakeApi(), BUILT_INS, 'light-steps');
      expect(screen.queryByRole('button', { name: 'Soak length' })).toBeNull();
      expect(screen.getByRole('cell', { name: '1:00' })).toBeInTheDocument();
    });

    it('a curve profile has its length too', () => {
      const curve = { profile: { ...CURVE, id: 'custom-c', name: 'My curve' }, builtIn: false };
      open(fakeApi(), [...BUILT_INS, curve], 'custom-c');
      expect(screen.getByRole('button', { name: 'Soak length' })).toHaveTextContent('1:00');
    });
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

  it('an edit undone by hand is no edit: no Edited badge, no Save', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Add step' }));
    const list = within(screen.getByRole('list', { name: 'Profiles' }));
    expect(list.getByRole('button', { name: /Mine/ })).toHaveTextContent('Edited');
    await userEvent.click(screen.getByRole('button', { name: 'Remove New step' }));
    expect(list.getByRole('button', { name: /Mine/ })).not.toHaveTextContent('Edited');
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByText('Not saved')).toBeNull();
  });

  it('a curve profile has curve points and no durations', () => {
    const curve = { profile: { ...CURVE, id: 'custom-c', name: 'My curve' }, builtIn: false };
    open(fakeApi(), [...BUILT_INS, curve], 'custom-c');
    expect(screen.getByRole('heading', { name: 'Curve points' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'RoR min' })).toBeNull();
  });

  it('shows the preview right under the top values, then the steps, then the curve points', () => {
    const curve = { profile: { ...CURVE, id: 'custom-c', name: 'My curve' }, builtIn: false };
    open(fakeApi(), [...BUILT_INS, curve], 'custom-c');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Preview', 'Steps', 'Curve points']);
    const batch = screen.getByRole('textbox', { name: 'Batch' });
    const preview = screen.getByRole('heading', { name: 'Preview' });
    expect(batch.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('asks once before deleting, then goes back to the one Auto uses', async () => {
    const api = fakeApi({ listProfiles: vi.fn(() => Promise.resolve(BUILT_INS)) });
    open(api);
    await userEvent.click(screen.getByRole('button', { name: /^More for (?!Profiles$)/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(api.deleteProfile).not.toHaveBeenCalled();
    const confirm = screen.getByRole('alertdialog', { name: 'Delete this profile?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
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

  it('Discard clears a refusal with the edit it was about', async () => {
    const api = fakeApi({
      saveProfile: vi.fn(() =>
        Promise.resolve(err({ kind: 'storage-failed' as const, message: 'Disk full' })),
      ),
    });
    open(api);
    await edit('BT cap', '205');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Disk full');
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('alert')).toBeNull();
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
    await userEvent.click(screen.getByRole('button', { name: /^More for (?!Profiles$)/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy to Simulator' }));
    expect(api.copyProfile).toHaveBeenCalledWith({ id: 'light-steps', roasterId: 2 });
    // One line under the header, never inside the actions beside the name.
    const message = await screen.findByText(/needs calibration there/);
    expect(
      screen.getByRole('button', { name: /^More for (?!Profiles$)/ }).parentElement,
    ).not.toContainElement(message);
  });
});
