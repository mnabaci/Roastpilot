import {
  AUTO_OFF,
  DEFAULT_SETTINGS,
  err,
  ok,
  READY_ROAST,
  type AutoProfile,
  type ProfileEntry,
} from '@roastpilot/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
/** What main does after a write: pushes the new list to the window. */
const pushProfiles = (stores: ReturnType<typeof renderApp>['stores'], profiles: ProfileEntry[]) => {
  act(() => {
    stores.auto.setState({ profiles });
  });
};
/** The open profile's name, its title. */
const profileTitle = () =>
  screen.getByRole('region', { name: 'Profile' }).querySelector('h2') ?? document.body;
/** A control only Edit mode has, pressing Edit first. */
const editingButton = async (name: string) => {
  await startEditing();
  return screen.getByRole('button', { name });
};
/** Edit mode, as you'd press Edit; a no-op once it is a form. */
const startEditing = async () => {
  const button = screen.queryByRole('button', { name: 'Edit' });
  if (button) await userEvent.click(button);
};
const edit = async (name: string, text: string) => {
  await startEditing();
  const field = screen.getByRole('textbox', { name });
  await userEvent.clear(field);
  await userEvent.type(field, text);
};

describe('ProfilesScreen', () => {
  it('opens the profile Auto uses, and lists the rest', () => {
    open();
    expect(profileTitle()).toHaveTextContent('Mine');
    // Auto's profile shows its badge in the header and in the list.
    const header = within(screen.getByRole('banner'));
    expect(header.getByText('Auto')).toBeInTheDocument();
    expect(header.queryByRole('button', { name: 'Use for Auto' })).toBeNull();
    const list = within(screen.getByRole('list', { name: 'Profiles' }));
    expect(list.getByRole('button', { name: /Mine/ })).toHaveTextContent('Auto');
    expect(list.getByRole('button', { name: 'Light · Curve' })).toBeInTheDocument();
  });

  it('a built-in cannot be edited, only duplicated', async () => {
    const api = fakeApi();
    const { stores } = open(api, BUILT_INS, 'light-steps');
    api.duplicateProfile.mockImplementation(() => {
      pushProfiles(stores, withMine);
      return Promise.resolve(ok(OWN));
    });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^More for (?!Profiles$)/ }));
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /calibrat/ })).toBeNull();
    await userEvent.keyboard('{Escape}');
    // Duplicate is its button, in Edit's place.
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(api.duplicateProfile).toHaveBeenCalledWith('light-steps');
    await waitFor(() => {
      expect(profileTitle()).toHaveTextContent('Mine');
    });
  });

  describe('when the reply comes before the pushed list', () => {
    it('a duplicate opens at once, and the push that follows changes nothing', async () => {
      const api = fakeApi({ duplicateProfile: vi.fn(() => Promise.resolve(ok(OWN))) });
      const { stores } = open(api, BUILT_INS, 'light-steps');
      await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
      await waitFor(() => {
        expect(profileTitle()).toHaveTextContent('Mine');
      });
      expect(stores.auto.getState().profiles.map((e) => e.profile.id)).toContain('custom-1');
      pushProfiles(stores, withMine);
      expect(profileTitle()).toHaveTextContent('Mine');
      expect(stores.auto.getState().profiles).toHaveLength(withMine.length);
    });

    it('a delete goes back to the one Auto uses at once, and the push changes nothing', async () => {
      const api = fakeApi({ deleteProfile: vi.fn(() => Promise.resolve(ok(undefined))) });
      const { stores } = open(api, withMine, 'light-steps');
      await userEvent.click(screen.getByRole('button', { name: 'Mine' }));
      await userEvent.click(screen.getByRole('button', { name: /^More for (?!Profiles$)/ }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      const confirm = screen.getByRole('alertdialog', { name: 'Delete this profile?' });
      await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
      await waitFor(() => {
        expect(profileTitle()).toHaveTextContent('Light · Steps');
      });
      pushProfiles(stores, BUILT_INS);
      expect(profileTitle()).toHaveTextContent('Light · Steps');
      expect(stores.auto.getState().profiles).toEqual(BUILT_INS);
    });

    it('a save shows the saved values at once, without waiting for the push', async () => {
      const { stores } = open();
      await edit('BT cap', '205');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(
          stores.auto.getState().profiles.find((e) => e.profile.id === 'custom-1')?.profile.capC,
        ).toBe(205);
      });
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    });

    it('an import opens the newest once the pushed list brings it', async () => {
      const imported = { ...STEPS, id: 'custom-9', name: 'From a friend' };
      const api = fakeApi({
        importLibrary: vi.fn(() =>
          Promise.resolve(
            ok({
              status: 'imported' as const,
              added: 1,
              skipped: 0,
              archived: 0,
              newestId: 'custom-9',
            }),
          ),
        ),
      });
      const { stores } = open(api);
      await userEvent.click(screen.getByRole('button', { name: 'More for Profiles' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Import a Roastpilot file' }));
      await waitFor(() => {
        expect(api.importLibrary).toHaveBeenCalled();
      });
      pushProfiles(stores, [...withMine, { profile: imported, builtIn: false }]);
      await waitFor(() => {
        expect(profileTitle()).toHaveTextContent('From a friend');
      });
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

  describe('in °F', () => {
    const inF = (profiles = withMine) =>
      renderApp(
        <ProfilesScreen />,
        {
          profiles,
          settings: { ...DEFAULT_SETTINGS, autoProfile: 'custom-1', temperatureUnit: 'f' },
        },
        fakeApi({ listProfiles: vi.fn(() => Promise.resolve(profiles)) }),
      );

    it('shows °F and saves what you type in °C, which shows as typed again', async () => {
      const { api } = inF();
      // BT cap 200 °C is 392 °F.
      expect(screen.getByLabelText('BT cap')).toHaveTextContent('392 °F');
      expect(screen.getByRole('columnheader', { name: 'Ends °F' })).toBeInTheDocument();
      // A rate is a difference: its unit follows too.
      expect(screen.getByRole('columnheader', { name: 'RoR °F/min' })).toBeInTheDocument();
      await edit('Charge temp', '370');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      // Kept to 0.1 °C; the rest stays exactly as it was.
      expect(api.saveProfile).toHaveBeenCalledWith({
        ...MINE,
        chargeC: 187.8,
        curve: [{ tS: 0, c: 187.8 }, ...MINE.curve.slice(1)],
      });
      const saved = { ...MINE, chargeC: 187.8 };
      inF([...BUILT_INS, { profile: saved, builtIn: false }]);
      expect(screen.getAllByLabelText('Charge temp').at(-1)).toHaveTextContent('370 °F');
    });

    it('says a limit in °F', async () => {
      inF();
      await edit('BT cap', '460');
      expect(screen.getByText('At most 455 °F')).toBeInTheDocument();
    });

    it('turns an unsaved °C edit into °F when the unit changes', async () => {
      const { stores } = open();
      await edit('BT cap', '205');
      act(() => {
        stores.settings.setState((s) => ({ settings: { ...s.settings, temperatureUnit: 'f' } }));
      });
      expect(screen.getByRole('textbox', { name: 'BT cap' })).toHaveValue('401');
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });
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
      await userEvent.click(await editingButton('Soak length'));
      await userEvent.click(screen.getByRole('option', { name: option }));
    };

    it('sets its length from a list, and saves it', async () => {
      const api = fakeApi({ listProfiles: vi.fn(() => Promise.resolve(withMine)) });
      open(api);
      expect(await editingButton('Soak length')).toHaveTextContent('1:00');
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

    it('a curve profile has its length too', async () => {
      const curve = { profile: { ...CURVE, id: 'custom-c', name: 'My curve' }, builtIn: false };
      open(fakeApi(), [...BUILT_INS, curve], 'custom-c');
      expect(await editingButton('Soak length')).toHaveTextContent('1:00');
    });
  });

  it('opens to read; Edit makes it a form, and Cancel goes back to what is saved', async () => {
    open();
    expect(screen.queryByRole('textbox', { name: 'BT cap' })).toBeNull();
    expect(screen.getByLabelText('BT cap')).toHaveTextContent('200 °C');
    await edit('BT cap', '205');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('BT cap')).toHaveTextContent('200 °C');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('keeps an unsaved edit while you look at another profile', async () => {
    open();
    await edit('BT cap', '205');
    await userEvent.click(screen.getByRole('button', { name: 'Light · Steps' }));
    expect(screen.getByLabelText('BT cap')).toHaveTextContent('200 °C');
    // Back on it, it opens as the form, with the edit.
    await userEvent.click(screen.getByRole('button', { name: /Mine/ }));
    expect(screen.getByRole('textbox', { name: 'BT cap' })).toHaveValue('205');
  });

  it('adds and removes steps', async () => {
    open();
    await userEvent.click(await editingButton('Add step'));
    expect(screen.getByRole('textbox', { name: 'Step 2 name' })).toHaveValue('New step');
    await userEvent.click(screen.getByRole('button', { name: 'Remove New step' }));
    expect(screen.getByRole('textbox', { name: 'Step 2 name' })).toHaveValue('Development');
    expect(screen.queryByRole('button', { name: 'Remove Development' })).toBeNull();
  });

  it('an edit undone by hand is no edit: no Edited badge, no Save', async () => {
    open();
    await userEvent.click(await editingButton('Add step'));
    const list = within(screen.getByRole('list', { name: 'Profiles' }));
    expect(list.getByRole('button', { name: /Mine/ })).toHaveTextContent('Edited');
    await userEvent.click(screen.getByRole('button', { name: 'Remove New step' }));
    expect(list.getByRole('button', { name: /Mine/ })).not.toHaveTextContent('Edited');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.queryByText('Not saved')).toBeNull();
  });

  it('a step profile groups RoR min and max under one header with its unit', () => {
    open();
    expect(screen.getByRole('columnheader', { name: 'RoR °C/min' })).toHaveAttribute(
      'colspan',
      '2',
    );
    expect(screen.getByRole('columnheader', { name: 'Min' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Max' })).toBeInTheDocument();
  });

  it('a curve profile has curve points and no durations', () => {
    const curve = { profile: { ...CURVE, id: 'custom-c', name: 'My curve' }, builtIn: false };
    open(fakeApi(), [...BUILT_INS, curve], 'custom-c');
    expect(screen.getByRole('heading', { name: 'Curve points' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^RoR/ })).toBeNull();
  });

  describe('moving a step', () => {
    const name = (n: number) => screen.getByRole('textbox', { name: `Step ${String(n)} name` });
    // Mine runs Soak · Heat on · New step · Development once a step is added.
    const openWithThree = async () => {
      const api = fakeApi({ listProfiles: vi.fn(() => Promise.resolve(withMine)) });
      open(api);
      await userEvent.click(await editingButton('Add step'));
      return api;
    };
    const press = async (handle: string, key: 'ArrowUp' | 'ArrowDown') => {
      screen.getByRole('button', { name: `Move ${handle}` }).focus();
      await userEvent.keyboard(`{Alt>}{${key}}{/Alt}`);
    };

    it('only the steps between Soak and Development have a handle', async () => {
      await openWithThree();
      expect(screen.getByRole('button', { name: 'Move Heat on' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Move New step' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Move Soak' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Move Development' })).toBeNull();
    });

    it('a built-in has no handles', () => {
      open(fakeApi(), BUILT_INS, 'light-steps');
      expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
    });

    it('Alt+↑ and Alt+↓ move it one place, keep focus on it and say so', async () => {
      await openWithThree();
      await press('New step', 'ArrowUp');
      expect(name(1)).toHaveValue('New step');
      expect(name(2)).toHaveValue('Heat on');
      expect(screen.getByRole('button', { name: 'Move New step' })).toHaveFocus();
      expect(screen.getByText('Moved New step to step 1')).toBeInTheDocument();
      await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(name(2)).toHaveValue('New step');
      expect(screen.getByRole('button', { name: 'Move New step' })).toHaveFocus();
    });

    it('keeps Soak first and Development last', async () => {
      await openWithThree();
      await press('Heat on', 'ArrowUp');
      expect(name(1)).toHaveValue('Heat on');
      await press('New step', 'ArrowDown');
      expect(name(2)).toHaveValue('New step');
      expect(name(3)).toHaveValue('Development');
    });

    it('an arrow without Alt does nothing', async () => {
      await openWithThree();
      await press('New step', 'ArrowUp');
      await userEvent.keyboard('{ArrowDown}');
      expect(name(1)).toHaveValue('New step');
    });

    it('a move into an order that makes no sense says so on the cell, and Save waits', async () => {
      const api = await openWithThree();
      await press('New step', 'ArrowUp');
      // Heat on ends at 150 °C, now after New step's 171 °C, with the same backup time.
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Heat on: Must be above the step before · Must be after the step before',
      );
      expect(screen.getByRole('textbox', { name: 'Heat on end temperature' })).toBeInvalid();
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      expect(api.saveProfile).not.toHaveBeenCalled();
    });

    describe('carrying it (Space, the arrows, Space)', () => {
      // jsdom has no layout: lay each step's group of rows (and all in it) out 50 px under the one
      // before, the table around them; the floating copy sits where its inline style puts it.
      const ROW_PX = 50;
      const placed = (style: CSSStyleDeclaration) =>
        new DOMRect(
          parseFloat(style.left),
          parseFloat(style.top),
          parseFloat(style.width),
          parseFloat(style.height),
        );
      let layout: { mockRestore: () => void } | undefined;
      beforeEach(() => {
        const zero = Element.prototype.getBoundingClientRect;
        layout = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
          this: Element,
        ) {
          const floating = this.closest<HTMLElement>('[style*="position: fixed"]');
          if (floating?.style.top) return placed(floating.style);
          if (this instanceof HTMLTableElement) {
            return new DOMRect(0, 0, 800, this.tBodies.length * ROW_PX);
          }
          const group = this.closest('tbody');
          const table = group?.parentElement;
          if (!group || !(table instanceof HTMLTableElement)) return zero.call(this);
          return new DOMRect(0, [...table.tBodies].indexOf(group) * ROW_PX, 800, ROW_PX);
        });
      });
      afterEach(() => {
        layout?.mockRestore();
      });
      const pickUp = async (handle: string) => {
        screen.getByRole('button', { name: `Move ${handle}` }).focus();
        await userEvent.keyboard('[Space]');
      };

      it('moves a step, values and all, and says where it went', async () => {
        await openWithThree();
        await pickUp('New step');
        expect(screen.getByText('Picked up New step, step 2 of 3')).toBeInTheDocument();
        await userEvent.keyboard('[ArrowUp]');
        expect(screen.getByText('New step, step 1 of 3')).toBeInTheDocument();
        await userEvent.keyboard('[Space]');
        expect(name(1)).toHaveValue('New step');
        expect(name(2)).toHaveValue('Heat on');
        expect(screen.getByRole('textbox', { name: 'New step end temperature' })).toHaveValue(
          '171',
        );
        expect(screen.getByText('Moved New step to step 1')).toBeInTheDocument();
      });

      it('Escape puts it back', async () => {
        await openWithThree();
        await pickUp('New step');
        await userEvent.keyboard('[ArrowUp]');
        await userEvent.keyboard('{Escape}');
        expect(name(1)).toHaveValue('Heat on');
        expect(name(2)).toHaveValue('New step');
        expect(screen.getByText('New step put back at step 2 of 3')).toBeInTheDocument();
      });

      it('Development is no place to drop a step', async () => {
        await openWithThree();
        await pickUp('Heat on');
        await userEvent.keyboard('[ArrowDown][ArrowDown][ArrowDown]');
        await userEvent.keyboard('[Space]');
        expect(name(2)).toHaveValue('Heat on');
        expect(name(3)).toHaveValue('Development');
      });

      it('Alt+arrows wait while a step is carried', async () => {
        await openWithThree();
        await pickUp('New step');
        await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
        await userEvent.keyboard('{Escape}');
        expect(name(1)).toHaveValue('Heat on');
        expect(name(2)).toHaveValue('New step');
      });

      it('the floating copy is only a picture, out of the way of screen readers', async () => {
        await openWithThree();
        await pickUp('New step');
        expect(screen.getAllByDisplayValue('New step')).toHaveLength(2);
        expect(screen.getAllByRole('textbox', { name: 'Step 2 name' })).toHaveLength(1);
        await userEvent.keyboard('{Escape}');
      });
    });
  });

  it('shows the preview right under the top values, then the steps, then the curve points', async () => {
    const curve = { profile: { ...CURVE, id: 'custom-c', name: 'My curve' }, builtIn: false };
    open(fakeApi(), [...BUILT_INS, curve], 'custom-c');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['My curve', 'Preview', 'Steps', 'Curve points']);
    await startEditing();
    const batch = screen.getByRole('textbox', { name: 'Tuned for' });
    expect(batch).toHaveAccessibleDescription('Batch size');
    const preview = screen.getByRole('heading', { name: 'Preview' });
    expect(batch.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('asks once before deleting, then goes back to the one Auto uses', async () => {
    const api = fakeApi();
    const { stores } = open(api, withMine, 'light-steps');
    api.deleteProfile.mockImplementation(() => {
      pushProfiles(stores, BUILT_INS);
      return Promise.resolve(ok(undefined));
    });
    await userEvent.click(screen.getByRole('button', { name: 'Mine' }));
    await userEvent.click(screen.getByRole('button', { name: /^More for (?!Profiles$)/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(api.deleteProfile).not.toHaveBeenCalled();
    const confirm = screen.getByRole('alertdialog', { name: 'Delete this profile?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(api.deleteProfile).toHaveBeenCalledWith('custom-1');
    await waitFor(() => {
      expect(profileTitle()).toHaveTextContent('Light · Steps');
    });
  });

  it('keeps Delete on the profile Auto uses, disabled with why', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'More for Mine' }));
    const item = screen.getByRole('menuitem', { name: 'Delete' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAccessibleDescription('Auto uses this one');
  });

  it('says so in a toast when main refuses a delete as in use', async () => {
    const api = fakeApi({
      deleteProfile: vi.fn(() => Promise.resolve(err({ kind: 'in-use' as const, id: 'custom-1' }))),
    });
    const { stores } = open(api, withMine, 'light-steps');
    await userEvent.click(screen.getByRole('button', { name: 'Mine' }));
    await userEvent.click(screen.getByRole('button', { name: 'More for Mine' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Delete this profile?' })).getByRole(
        'button',
        { name: 'Delete' },
      ),
    );
    await waitFor(() => {
      expect(stores.toasts.getState().toasts.map((t) => [t.kind, t.text])).toContainEqual([
        'error',
        "Can't delete a profile Auto uses or is running",
      ]);
    });
    expect(profileTitle()).toHaveTextContent('Mine');
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
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('calibration', () => {
    const header = () => within(screen.getByRole('banner'));
    const choose = async (item: string) => {
      await userEvent.click(screen.getByRole('button', { name: /^More for (?!Profiles$)/ }));
      await userEvent.click(screen.getByRole('menuitem', { name: item }));
    };

    it('Mark as calibrated saves only that, and keeps an unsaved edit', async () => {
      const calibrated = { ...MINE, needsCalibration: false };
      const api = fakeApi();
      const { stores } = open(api);
      api.saveProfile.mockImplementation((profile) => {
        pushProfiles(stores, [...BUILT_INS, { profile, builtIn: false }]);
        return Promise.resolve(ok({ profile, builtIn: false }));
      });
      expect(header().getByText('Needs calibration')).toBeInTheDocument();
      await edit('BT cap', '205');
      await choose('Mark as calibrated');
      expect(api.saveProfile).toHaveBeenCalledWith(calibrated);
      await waitFor(() => {
        expect(header().queryByText('Needs calibration')).toBeNull();
      });
      expect(screen.getByRole('textbox', { name: 'BT cap' })).toHaveValue('205');
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('can be undone with Mark as needs calibration', async () => {
      const calibrated = { profile: { ...MINE, needsCalibration: false }, builtIn: false };
      const api = fakeApi();
      open(api, [...BUILT_INS, calibrated]);
      expect(header().queryByText('Needs calibration')).toBeNull();
      await choose('Mark as needs calibration');
      expect(api.saveProfile).toHaveBeenCalledWith({ ...MINE, needsCalibration: true });
    });

    it('says so when storage refuses', async () => {
      const api = fakeApi({
        saveProfile: vi.fn(() =>
          Promise.resolve(err({ kind: 'storage-failed' as const, message: 'Disk full' })),
        ),
      });
      open(api);
      await choose('Mark as calibrated');
      expect(await screen.findByRole('alert')).toHaveTextContent('Disk full');
      expect(header().getByText('Needs calibration')).toBeInTheDocument();
    });
  });

  describe('while Auto runs a profile', () => {
    const running = {
      auto: { ...AUTO_OFF, enabled: true },
      roast: { ...READY_ROAST, phase: 'roasting' as const },
    };
    const openRunning = (id: string) =>
      renderApp(<ProfilesScreen />, { profiles: withMine, ...settingsOn(id), ...running });
    // The steps table has a status line of its own, for drags.
    const lockBanner = () => {
      const banner = screen.getByText(/^Auto is running/).closest('[role="status"]');
      if (!banner) throw new Error('the banner is not a status');
      return banner;
    };

    it('holds Save and Delete for the one it runs, and keeps your edit', async () => {
      openRunning('custom-1');
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: /^More for (?!Profiles$)/ }));
      expect(screen.queryByRole('menuitem', { name: /calibrat/ })).toBeNull();
      await userEvent.keyboard('{Escape}');
      await edit('BT cap', '205');
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'BT cap' })).toHaveValue('205');
    });

    it('says why Save waits in a banner right under the title, gone at Drop with the edit kept', async () => {
      const { stores } = openRunning('custom-1');
      await edit('BT cap', '205');
      const banner = lockBanner();
      expect(banner).toHaveTextContent('Auto is running this profile · edits save after Drop');
      // Under the title, before the rest of the editor.
      const title = screen.getByRole('textbox', { name: 'Name' });
      // (Edit mode: the name is a field.)
      expect(title.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      act(() => {
        stores.roast.setState({ roast: { ...READY_ROAST, phase: 'cooling' } });
      });
      expect(screen.queryByText(/Auto is running this profile/)).toBeNull();
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
      expect(screen.getByRole('textbox', { name: 'BT cap' })).toHaveValue('205');
    });

    it('holds Use for Auto, but other profiles can still be saved', async () => {
      openRunning('light-steps');
      await userEvent.click(screen.getByRole('button', { name: 'Mine' }));
      expect(screen.getByRole('button', { name: 'Use for Auto' })).toBeDisabled();
      expect(lockBanner()).toHaveTextContent(
        'Auto is running another profile · Use for Auto after Drop',
      );
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
    const message = await screen.findByText(
      /Copied to Simulator as "Mine" · make Simulator active to see it$/,
    );
    expect(
      screen.getByRole('button', { name: /^More for (?!Profiles$)/ }).parentElement,
    ).not.toContainElement(message);
  });

  it('names the copy a roaster already has instead of making another', async () => {
    const api = fakeApi({
      copyProfile: vi.fn(() =>
        Promise.resolve(
          err({ kind: 'already-copied' as const, id: 'custom-9', name: 'Light · Steps (from X)' }),
        ),
      ),
    });
    renderApp(
      <ProfilesScreen />,
      { profiles: withMine, ...settingsOn('light-steps'), roasters: roastersWith(null) },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: /^More for (?!Profiles$)/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy to Simulator' }));
    expect(
      await screen.findByText(/Simulator already has it as "Light · Steps \(from X\)"$/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('files', () => {
    it("the profile's ⋯ exports it, before Delete", async () => {
      const { api } = open();
      await userEvent.click(screen.getByRole('button', { name: 'More for Mine' }));
      const items = screen
        .getAllByRole('menuitem')
        .map((item) => item.getAttribute('aria-label') ?? item.textContent);
      expect(items.slice(-2)).toEqual(['Export this profile', 'Delete']);
      await userEvent.click(screen.getByRole('menuitem', { name: 'Export this profile' }));
      expect(api.exportLibrary).toHaveBeenCalledWith({ kind: 'profiles', ids: ['custom-1'] });
    });

    it('the list ⋯ has New from milestones, Export all and Import', async () => {
      const { api } = open();
      await userEvent.click(screen.getByRole('button', { name: 'More for Profiles' }));
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        'New from milestones',
        'Export all',
        'Import a Roastpilot file',
        'Select',
      ]);
      await userEvent.click(screen.getByRole('menuitem', { name: 'Export all' }));
      expect(api.exportLibrary).toHaveBeenCalledWith({ kind: 'profiles' });
    });

    it('an import reloads the list and opens the newest profile added', async () => {
      const imported = { ...STEPS, id: 'custom-9', name: 'From a friend', needsCalibration: true };
      const api = fakeApi();
      const { stores } = open(api);
      api.importLibrary.mockImplementation(() => {
        pushProfiles(stores, [...withMine, { profile: imported, builtIn: false }]);
        return Promise.resolve(
          ok({
            status: 'imported' as const,
            added: 1,
            skipped: 0,
            archived: 0,
            newestId: 'custom-9',
          }),
        );
      });
      await userEvent.click(screen.getByRole('button', { name: 'More for Profiles' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Import a Roastpilot file' }));
      expect(api.importLibrary).toHaveBeenCalledWith('profiles');
      expect(await screen.findByRole('button', { name: 'More for From a friend' })).toBeTruthy();
      expect(stores.toasts.getState().toasts.map((t) => t.text)).toContain('Imported 1 profile');
    });
  });

  describe('select', () => {
    const TWO: AutoProfile = { ...STEPS, id: 'custom-2', name: 'Two' };
    const THREE: AutoProfile = { ...STEPS, id: 'custom-3', name: 'Three' };
    const many = [
      ...withMine,
      { profile: TWO, builtIn: false },
      { profile: THREE, builtIn: false },
    ];
    const list = () => within(screen.getByRole('list', { name: 'Profiles' }));
    const box = (name: RegExp | string) => list().getByRole('checkbox', { name });
    const startSelect = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'More for Profiles' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Select' }));
    };

    it("ticks your own; built-ins and Auto's profile can't be ticked and say why", async () => {
      renderApp(<ProfilesScreen />, { profiles: many, ...settingsOn('custom-1') });
      await startSelect();
      expect(box(/Light · Steps/)).toHaveAttribute('aria-disabled', 'true');
      expect(box(/Light · Steps/)).toHaveTextContent('Built-in');
      expect(box(/Mine/)).toHaveTextContent('Auto uses this one');
      await userEvent.click(box(/Mine/));
      expect(box(/Mine/)).not.toBeChecked();
      // A click ticks instead of opening; Shift ticks the range.
      await userEvent.click(box('Two'));
      const user = userEvent.setup();
      await user.keyboard('{Shift>}');
      await user.click(box('Three'));
      await user.keyboard('{/Shift}');
      expect(box('Two')).toBeChecked();
      expect(box('Three')).toBeChecked();
      expect(profileTitle()).toHaveTextContent('Mine');
      expect(screen.getByRole('toolbar', { name: 'Selected profiles' })).toHaveTextContent(
        '2 selected',
      );
    });

    it('says the one Auto is running is running now', async () => {
      renderApp(<ProfilesScreen />, {
        profiles: many,
        ...settingsOn('custom-2'),
        auto: { ...AUTO_OFF, enabled: true },
        roast: { ...READY_ROAST, phase: 'roasting' as const },
      });
      await startSelect();
      expect(box(/Two/)).toHaveTextContent('Running now');
      expect(box(/Two/)).toHaveAttribute('aria-disabled', 'true');
      expect(box('Mine')).not.toHaveAttribute('aria-disabled');
    });

    it('exports the ticked ones', async () => {
      const { api } = renderApp(<ProfilesScreen />, { profiles: many, ...settingsOn('custom-1') });
      await startSelect();
      expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
      await userEvent.click(box('Two'));
      await userEvent.click(box('Three'));
      await userEvent.click(screen.getByRole('button', { name: 'Export' }));
      expect(api.exportLibrary).toHaveBeenCalledWith({
        kind: 'profiles',
        ids: ['custom-2', 'custom-3'],
      });
    });

    it('deletes the ticked ones after asking once, then opens the one Auto uses', async () => {
      const api = fakeApi();
      const { stores } = renderApp(
        <ProfilesScreen />,
        { profiles: many, ...settingsOn('custom-1') },
        api,
      );
      api.deleteProfiles.mockImplementation(() => {
        pushProfiles(stores, withMine);
        return Promise.resolve(ok(undefined));
      });
      // An unsaved edit of one that goes, goes with it.
      await userEvent.click(list().getByRole('button', { name: 'Two' }));
      await edit('BT cap', '205');
      await startSelect();
      await userEvent.click(box(/Two/));
      await userEvent.click(box('Three'));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = screen.getByRole('alertdialog', { name: 'Delete 2 profiles?' });
      expect(dialog).toHaveTextContent('saved roasts keep their copy');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
      expect(api.deleteProfiles).toHaveBeenCalledWith(['custom-2', 'custom-3']);
      await waitFor(() => {
        expect(screen.queryByRole('toolbar', { name: 'Selected profiles' })).toBeNull();
      });
      expect(profileTitle()).toHaveTextContent('Mine');
      expect(list().queryByRole('button', { name: /Two/ })).toBeNull();
      expect(stores.auto.getState().drafts).toEqual({});
      expect(stores.toasts.getState().toasts.map((t) => t.text)).toContain('Deleted 2 profiles');
    });

    it('says which refusal it was when main finds one in use', async () => {
      const api = fakeApi({
        deleteProfiles: vi.fn(() =>
          Promise.resolve(err({ kind: 'in-use' as const, id: 'custom-2' })),
        ),
      });
      const { stores } = renderApp(
        <ProfilesScreen />,
        { profiles: many, ...settingsOn('custom-1') },
        api,
      );
      await startSelect();
      await userEvent.click(box('Two'));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await userEvent.click(
        within(screen.getByRole('alertdialog', { name: 'Delete 1 profile?' })).getByRole('button', {
          name: 'Delete',
        }),
      );
      await waitFor(() => {
        expect(stores.toasts.getState().toasts.map((t) => t.text)).toContain(
          "Can't delete a profile Auto uses or is running",
        );
      });
    });

    it('keeps them all and says so when the delete is refused', async () => {
      const api = fakeApi({
        deleteProfiles: vi.fn(() =>
          Promise.resolve(err({ kind: 'storage-failed' as const, message: 'locked' })),
        ),
      });
      const { stores } = renderApp(
        <ProfilesScreen />,
        { profiles: many, ...settingsOn('custom-1') },
        api,
      );
      await startSelect();
      await userEvent.click(box('Two'));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await userEvent.click(
        within(screen.getByRole('alertdialog', { name: 'Delete 1 profile?' })).getByRole('button', {
          name: 'Delete',
        }),
      );
      await waitFor(() => {
        expect(stores.toasts.getState().toasts.map((t) => [t.kind, t.text])).toContainEqual([
          'error',
          "Couldn't delete them · see Logs",
        ]);
      });
      expect(box('Two')).toBeChecked();
    });

    it('Done leaves select mode and a click opens again', async () => {
      renderApp(<ProfilesScreen />, { profiles: many, ...settingsOn('custom-1') });
      await startSelect();
      await userEvent.click(box('Two'));
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(list().queryByRole('checkbox')).toBeNull();
      await userEvent.click(list().getByRole('button', { name: 'Two' }));
      expect(profileTitle()).toHaveTextContent('Two');
    });
  });
});
