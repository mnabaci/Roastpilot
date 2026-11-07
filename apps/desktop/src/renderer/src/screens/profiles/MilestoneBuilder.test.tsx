import { DEFAULT_SETTINGS, err, ok, type AutoProfile } from '@roastpilot/shared';
import type * as Ui from '@roastpilot/ui';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BUILT_INS, CURVE, STEPS } from '../../test/profiles';
import { fakeApi, renderApp } from '../../test/render-app';
import { ProfilesScreen } from './ProfilesScreen';

vi.mock('@roastpilot/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  RoastChart: (await import('../../test/fake-ui')).FakeRoastChart,
}));

const MADE: AutoProfile = { ...CURVE, id: 'custom-9', name: 'Milestones' };

function open(api = fakeApi()) {
  renderApp(
    <ProfilesScreen />,
    { profiles: BUILT_INS, settings: { ...DEFAULT_SETTINGS, autoProfile: 'light-steps' } },
    api,
  );
  return api;
}

async function startBuilding(user = userEvent.setup()) {
  await user.click(screen.getByRole('button', { name: 'More for Profiles' }));
  await user.click(screen.getByRole('menuitem', { name: 'New from milestones' }));
  return within(screen.getByRole('region', { name: 'Milestones' }));
}

const retype = async (field: HTMLElement, text: string) => {
  await userEvent.clear(field);
  await userEvent.type(field, text);
};

describe('MilestoneBuilder', () => {
  it("starts from the built-in curve's milestones", async () => {
    open();
    const table = await startBuilding();
    expect(screen.getByRole('heading', { name: 'New from milestones' })).toBeInTheDocument();
    expect(screen.getByText('Soak and fan steps from Light · Curve')).toBeInTheDocument();
    expect(table.getByLabelText('Charge temperature')).toHaveValue('180');
    expect(table.getByLabelText('Turning point time')).toHaveValue('1:04');
    expect(table.getByLabelText('Dry end temperature')).toHaveValue('150');
    expect(table.getByLabelText('First crack time')).toHaveValue('8:30');
    expect(table.getByLabelText('Drop time')).toHaveValue('10:00');
  });

  it('creates the profile from what you typed, then opens it', async () => {
    const api = fakeApi({
      makeProfileFromMilestones: vi.fn(() =>
        Promise.resolve(ok({ profile: MADE, builtIn: false })),
      ),
      listProfiles: vi.fn(() => Promise.resolve([...BUILT_INS, { profile: MADE, builtIn: false }])),
    });
    open(api);
    const table = await startBuilding();
    await retype(table.getByLabelText('Drop temperature'), '201');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Milestones');
    });
    expect(api.makeProfileFromMilestones).toHaveBeenCalledWith(
      expect.objectContaining({ drop: { tS: 600, c: 201 }, extras: [] }),
    );
  });

  it('shows a problem next to its cell, and Create waits', async () => {
    open();
    const table = await startBuilding();
    await retype(table.getByLabelText('First crack temperature'), '140');
    expect(table.getByText('Above 150 °C at 5:05')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    await retype(table.getByLabelText('Drop time'), '10');
    expect(table.getByText('Enter a time like 1:30')).toBeInTheDocument();
  });

  it('adds your own point and takes it out again', async () => {
    open();
    const table = await startBuilding();
    await userEvent.click(table.getByRole('button', { name: 'Add point' }));
    expect(table.getByLabelText('Your point 1 time')).toHaveValue('6:48');
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
    await userEvent.click(table.getByRole('button', { name: 'Remove your point 1' }));
    expect(table.queryByLabelText('Your point 1 time')).toBeNull();
  });

  it('says so when saving fails, and stays on the builder', async () => {
    const api = fakeApi({
      makeProfileFromMilestones: vi.fn(() =>
        Promise.resolve(err({ kind: 'storage-failed' as const, message: 'locked' })),
      ),
    });
    open(api);
    await startBuilding();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save that");
    expect(screen.getByRole('region', { name: 'Milestones' })).toBeInTheDocument();
  });

  it('Cancel, or picking a profile, goes back to the editor', async () => {
    open();
    await startBuilding();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Light · Steps');
    await startBuilding();
    const list = within(screen.getByRole('list', { name: 'Profiles' }));
    await userEvent.click(list.getByRole('button', { name: 'Light · Curve' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Light · Curve');
  });

  it('has no menu when the roaster has no curve profile to start from', () => {
    renderApp(<ProfilesScreen />, { profiles: [{ profile: STEPS, builtIn: true }] });
    expect(screen.queryByRole('button', { name: 'More for Profiles' })).toBeNull();
  });
});
