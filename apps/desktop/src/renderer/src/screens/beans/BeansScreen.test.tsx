import { err, ok, READY_ROAST, type AutoProfile, type RoastSummary } from '@roastpilot/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fakeApi, renderApp } from '../../test/render-app';
import { BEAN } from '../../test/beans';
import { SKYWALKER } from '../../test/roasters';
import { BeansScreen } from './BeansScreen';

const ROAST = {
  id: 4,
  startedAt: '2026-11-04T10:00:00.000Z',
  beanId: 1,
  isFavourite: true,
  rating: 5,
  endedAt: 'x',
  fcTimeS: null,
  fcTemp: null,
  dropTimeS: null,
  dropTemp: null,
  profileId: null,
  profileName: 'Light · Steps',
  batchG: 356,
  roastedG: 305,
} as RoastSummary;

function show(api = fakeApi(), beans = [BEAN]) {
  const onRoast = vi.fn();
  const onOpenProfile = vi.fn();
  const view = renderApp(
    <BeansScreen onRoast={onRoast} onOpenProfile={onOpenProfile} />,
    { beans, roasters: [SKYWALKER] },
    api,
  );
  return { ...view, onRoast, onOpenProfile };
}

describe('BeansScreen', () => {
  it('says what to do with no beans', () => {
    show(fakeApi(), []);
    expect(screen.getByText(/No beans yet/)).toBeTruthy();
  });

  it('lists a bean with its stock and a low-stock badge, and opens it', () => {
    show();
    const nav = within(screen.getByRole('navigation', { name: 'Beans' }));
    expect(nav.getByText('300 g · Ethiopia · washed')).toBeTruthy();
    expect(nav.getByText('Low')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Yirgacheffe' })).toBeTruthy();
    expect(
      screen.getByText(/^Dense beans \(830 g\/L\): these often take heat slowly/),
    ).toBeTruthy();
  });

  it('adds a bean once name and origin are in', async () => {
    const user = userEvent.setup();
    const { api } = show();
    await user.click(screen.getByRole('button', { name: 'Add bean' }));
    const form = within(screen.getByRole('region', { name: 'Add bean' }));
    const save = form.getByRole('button', { name: 'Add bean' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    await user.type(form.getByLabelText('Name'), 'Sidamo');
    await user.type(form.getByLabelText('Origin'), 'Ethiopia');
    await user.click(save);
    await waitFor(() => {
      expect(api.addBean).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sidamo' }));
    });
  });

  it('adds stock with a picked plan', async () => {
    const user = userEvent.setup();
    const { api } = show();
    await user.click(screen.getByRole('button', { name: 'Add stock' }));
    await user.type(screen.getByLabelText('Order weight'), '1000');
    const equal = within(screen.getByRole('region', { name: 'Equal splits' }));
    expect(equal.getByText('3 × 333 g (+1 g)')).toBeTruthy();
    await user.click(equal.getByRole('button', { name: 'Pick' }));
    await user.click(screen.getByRole('button', { name: 'Add 1,000 g' }));
    await waitFor(() => {
      expect(api.addStock).toHaveBeenCalledWith(
        expect.objectContaining({ beanId: 1, grams: 1000, plan: expect.anything() as unknown }),
      );
    });
  });

  it('adjusts stock by hand', async () => {
    const user = userEvent.setup();
    const { api } = show();
    await user.click(screen.getByRole('button', { name: `More for ${BEAN.name}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Adjust stock' }));
    const form = within(screen.getByRole('region', { name: 'Adjust stock' }));
    const green = form.getByLabelText('Green');
    await user.clear(green);
    await user.type(green, '250');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(api.adjustStock).toHaveBeenCalledWith({ beanId: 1, greenG: 250, roastedG: 100 });
    });
  });

  it('Roast this bean sets up the next roast from its plan, then opens Roast', async () => {
    const user = userEvent.setup();
    const { api, onRoast, stores } = show();
    await user.click(screen.getByRole('button', { name: 'Roast this bean' }));
    const setup = { beanId: 1, batchG: 375, ghostRoastId: null };
    await waitFor(() => {
      expect(onRoast).toHaveBeenCalled();
    });
    expect(api.setRoastSetup).toHaveBeenCalledWith(setup);
    expect(stores.beans.getState().setup).toEqual(setup);
  });

  it('Roast this bean waits while a roast runs', () => {
    renderApp(<BeansScreen onRoast={() => undefined} onOpenProfile={() => undefined} />, {
      beans: [BEAN],
      roasters: [SKYWALKER],
      roast: { ...READY_ROAST, phase: 'roasting' },
    });
    const button = screen.getByRole('button', { name: 'Roast this bean' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('Roast this bean waits for a roaster', () => {
    renderApp(<BeansScreen onRoast={() => undefined} onOpenProfile={() => undefined} />, {
      beans: [BEAN],
      roasters: [],
    });
    const button = screen.getByRole('button', { name: 'Roast this bean' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('holds stock back until Bought on is a real date', async () => {
    const user = userEvent.setup();
    const { api } = show();
    await user.click(screen.getByRole('button', { name: 'Add stock' }));
    await user.type(screen.getByLabelText('Order weight'), '1000');
    const date = screen.getByLabelText('Bought on');
    await user.clear(date);
    await user.type(date, 'last week');
    expect(screen.getByText(/Enter a date like/)).toBeTruthy();
    const add = screen.getByRole('button', { name: 'Add 1,000 g' });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    await user.clear(date);
    await user.type(date, '2026-11-02');
    await user.click(add);
    await waitFor(() => {
      expect(api.addStock).toHaveBeenCalledWith(
        expect.objectContaining({ purchasedAt: '2026-11-02' }),
      );
    });
  });

  it('Make a profile waits for a profile to copy', async () => {
    const user = userEvent.setup();
    const { api } = show();
    await user.click(screen.getByRole('button', { name: `More for ${BEAN.name}` }));
    const item = screen.getByRole('menuitem', { name: 'Make a profile' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(api.makeBeanProfile).not.toHaveBeenCalled();
  });

  /** The Beans screen with one built-in profile to copy, and `api`. */
  function showWithProfile(api: ReturnType<typeof fakeApi>) {
    const onOpenProfile = vi.fn();
    const view = renderApp(
      <BeansScreen onRoast={() => undefined} onOpenProfile={onOpenProfile} />,
      {
        beans: [BEAN],
        roasters: [SKYWALKER],
        profiles: [{ profile: { id: 'light-steps' } as never, builtIn: true }],
      },
      api,
    );
    return { ...view, onOpenProfile };
  }

  async function pickMakeProfile() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: `More for ${BEAN.name}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Make a profile' }));
  }

  it('makes a profile for the bean in one call, then opens it', async () => {
    const profile = { id: 'custom-9', name: 'Yirgacheffe' } as AutoProfile;
    const api = fakeApi({
      makeBeanProfile: vi.fn(() => Promise.resolve(ok({ profile, builtIn: false }))),
    });
    const { onOpenProfile } = showWithProfile(api);
    await pickMakeProfile();
    await waitFor(() => {
      expect(onOpenProfile).toHaveBeenCalledWith('custom-9');
    });
    expect(api.makeBeanProfile).toHaveBeenCalledTimes(1);
    expect(api.makeBeanProfile).toHaveBeenCalledWith({ beanId: 1, profileId: 'light-steps' });
    expect(api.duplicateProfile).not.toHaveBeenCalled();
    expect(api.saveProfile).not.toHaveBeenCalled();
    expect(api.updateBean).not.toHaveBeenCalled();
    expect(api.listProfiles).toHaveBeenCalled();
  });

  it('says so in one line when main could not make it, and opens nothing', async () => {
    const api = fakeApi({
      makeBeanProfile: vi.fn(() =>
        Promise.resolve(err({ kind: 'storage-failed' as const, message: 'locked' })),
      ),
    });
    const { onOpenProfile } = showWithProfile(api);
    await pickMakeProfile();
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't make the profile");
    expect(onOpenProfile).not.toHaveBeenCalled();
  });

  it('shows an error toast when the call itself fails', async () => {
    const api = fakeApi({
      makeBeanProfile: vi.fn(() => Promise.reject(new Error('main went away'))),
    });
    const { onOpenProfile, stores } = showWithProfile(api);
    await pickMakeProfile();
    await waitFor(() => {
      expect(stores.toasts.getState().toasts).toEqual([
        expect.objectContaining({ kind: 'error', text: "Couldn't make the profile · try again" }),
      ]);
    });
    expect(onOpenProfile).not.toHaveBeenCalled();
  });

  it('shows its roasts with the best favourite', async () => {
    const api = fakeApi({ listRoasts: vi.fn(() => Promise.resolve([ROAST])) });
    show(api);
    expect(await screen.findByText(/Best favourite/)).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Roasts of Yirgacheffe' });
    expect(within(table).getAllByRole('row')[1]?.textContent).toContain('Auto · Light · Steps');
    expect(within(table).getByText('356 → 305 g')).toBeInTheDocument();
    expect(within(table).getByText('14.3 %')).toBeInTheDocument();
  });

  it('orders again from the saved link, through main; no link, no button', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    show(api, [{ ...BEAN, link: 'https://www.shop.example/yirgacheffe' }]);
    // Under the supplier in the bean's card, as written.
    const about = within(screen.getByRole('region', { name: 'About this bean' }));
    expect(about.getByText('shop.example')).not.toHaveClass('first-letter:uppercase');
    await user.click(screen.getByRole('button', { name: 'Order again' }));
    expect(api.openBeanLink).toHaveBeenCalledWith(BEAN.id);
  });

  it("sets out the bean's facts as tiles, its order link's site under the supplier, and its hints", () => {
    show(fakeApi(), [
      {
        ...BEAN,
        process: 'natural',
        supplier: 'Green Coffee Collective',
        link: 'https://www.greencoffee.example/african-moon',
      },
    ]);
    const about = within(screen.getByRole('region', { name: 'About this bean' }));
    const supplier = about.getByText('Supplier').parentElement!;
    expect(supplier.textContent).toBe('SupplierGreen Coffee Collectivegreencoffee.example');
    expect(about.getAllByRole('listitem').some((li) => li.textContent.startsWith('Natural'))).toBe(
      true,
    );
  });

  it('has no Order again for a bean without a link', () => {
    show();
    expect(screen.queryByRole('button', { name: 'Order again' })).toBeNull();
  });

  it('archives, and hides archived beans until asked', async () => {
    const user = userEvent.setup();
    const { api } = show(fakeApi(), [BEAN, { ...BEAN, id: 2, name: 'Old', archived: true }]);
    expect(screen.queryByRole('button', { name: /^Old/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More for Beans' }));
    await user.click(screen.getByRole('menuitem', { name: 'Show archived' }));
    // Shown, it says it is archived; the others don't.
    expect(screen.getByRole('button', { name: /^Old/ })).toHaveTextContent('Archived');
    expect(screen.getByRole('button', { name: new RegExp(`^${BEAN.name}`) })).not.toHaveTextContent(
      'Archived',
    );
    await user.click(screen.getByRole('button', { name: `More for ${BEAN.name}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }));
    await waitFor(() => {
      expect(api.setBeanArchived).toHaveBeenCalledWith({ id: 1, archived: true });
    });
  });

  it('says so when archiving fails', async () => {
    const user = userEvent.setup();
    show(
      fakeApi({
        setBeanArchived: vi.fn(() =>
          Promise.resolve(err({ kind: 'storage-failed' as const, message: 'locked' })),
        ),
      }),
    );
    await user.click(screen.getByRole('button', { name: `More for ${BEAN.name}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't change that");
  });

  it('has the calculator on its own', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: 'More for Beans' }));
    await user.click(screen.getByRole('menuitem', { name: 'Batch calculator' }));
    // A dialog over the list, so the bean behind it stays where it was.
    const dialog = within(screen.getByRole('dialog', { name: 'Batch calculator' }));
    await user.type(dialog.getByLabelText('Order weight'), '1000');
    expect(dialog.getByText('2 × 375 g + 250 g')).toBeTruthy();
    expect(dialog.queryByRole('button', { name: 'Pick' })).toBeNull();
    // A common order is one tap.
    await user.click(dialog.getByRole('button', { name: '2 kg' }));
    expect(dialog.getByLabelText('Order weight')).toHaveValue('2000');
    await user.click(dialog.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  describe('files', () => {
    const toasts = (stores: ReturnType<typeof show>['stores']) =>
      stores.toasts.getState().toasts.map((t) => [t.kind, t.text]);

    it("the bean's ⋯ exports it; Beans ⋯ exports all and imports", async () => {
      const api = fakeApi({
        exportLibrary: vi.fn(() =>
          Promise.resolve(ok({ status: 'saved' as const, fileName: 'beans.rpr' })),
        ),
      });
      const { stores } = show(api);
      await userEvent.click(screen.getByRole('button', { name: `More for ${BEAN.name}` }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Export this bean' }));
      expect(api.exportLibrary).toHaveBeenCalledWith({ kind: 'beans', ids: [BEAN.id] });
      await userEvent.click(screen.getByRole('button', { name: 'More for Beans' }));
      const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
      expect(items.slice(-3)).toEqual(['Export all', 'Import a Roastpilot file', 'Select']);
      await userEvent.click(screen.getByRole('menuitem', { name: 'Export all' }));
      expect(api.exportLibrary).toHaveBeenLastCalledWith({ kind: 'beans' });
      expect(toasts(stores)).toContainEqual(['success', 'Saved beans.rpr']);
    });

    it('Export all waits until there is a bean', async () => {
      show(fakeApi(), []);
      await userEvent.click(screen.getByRole('button', { name: 'More for Beans' }));
      expect(screen.getByRole('menuitem', { name: 'Export all' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('an import says what came in and opens the newest bean added', async () => {
      const second = { ...BEAN, id: 2, name: 'Huila' };
      const api = fakeApi({
        importLibrary: vi.fn(() =>
          Promise.resolve(
            ok({ status: 'imported' as const, added: 3, skipped: 1, archived: 0, newestId: 2 }),
          ),
        ),
      });
      const { stores } = show(api, [BEAN, second]);
      await userEvent.click(screen.getByRole('button', { name: 'More for Beans' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Import a Roastpilot file' }));
      expect(api.importLibrary).toHaveBeenCalledWith('beans');
      expect(await screen.findByRole('heading', { level: 2, name: 'Huila' })).toBeInTheDocument();
      expect(toasts(stores)).toContainEqual(['success', 'Imported 3 beans · 1 was already here']);
    });

    it('says why a file was refused', async () => {
      const api = fakeApi({
        importLibrary: vi.fn(() =>
          Promise.resolve(
            err({ kind: 'bad-item' as const, name: 'Guji', reason: 'Origin: Enter an origin' }),
          ),
        ),
      });
      const { stores } = show(api);
      await userEvent.click(screen.getByRole('button', { name: 'More for Beans' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Import a Roastpilot file' }));
      await waitFor(() => {
        expect(toasts(stores)).toContainEqual([
          'error',
          '"Guji" can\'t come in · Origin: Enter an origin',
        ]);
      });
    });
  });
});
