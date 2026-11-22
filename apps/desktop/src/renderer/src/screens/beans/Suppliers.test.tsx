import { err, ok, type Bean, type Supplier } from '@roastpilot/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WORDS_AND_SHEETS, withKey } from '../../test/ai-providers';
import { BEAN } from '../../test/beans';
import { ACCEPTED_SETTINGS, fakeApi, renderApp } from '../../test/render-app';
import { SKYWALKER } from '../../test/roasters';
import { AddBean } from './AddBean';
import { BeansScreen } from './BeansScreen';

const FALCON: Supplier = {
  id: 1,
  name: 'Falcon',
  website: 'https://www.falcon.coffee',
  email: 'sales@falcon.coffee',
  phone: '+44 1234 567890',
  notes: null,
};
const NORDIC: Supplier = { ...FALCON, id: 2, name: 'Nordic', website: null, phone: null };
const WITH_FALCON: Bean = { ...BEAN, supplier: 'Falcon', supplierId: 1 };

function show(api = fakeApi(), beans: Bean[] = [WITH_FALCON], suppliers = [FALCON, NORDIC]) {
  return renderApp(
    <BeansScreen onRoast={vi.fn()} onOpenProfile={vi.fn()} />,
    { beans, suppliers, roasters: [SKYWALKER] },
    api,
  );
}

const about = () => within(screen.getByRole('region', { name: 'About this bean' }));

describe("A bean's supplier", () => {
  it('reads as its name with its email and phone under it, opening its card', async () => {
    const user = userEvent.setup();
    const { api } = show();
    expect(about().getByText('sales@falcon.coffee · +44 1234 567890')).toBeInTheDocument();
    await user.click(about().getByRole('button', { name: 'Falcon, supplier details' }));
    const card = within(await screen.findByRole('dialog', { name: 'Falcon' }));
    expect(card.getByText('Supplies Yirgacheffe')).toBeInTheDocument();
    expect(card.getByText('sales@falcon.coffee')).toBeInTheDocument();
    expect(card.getByText('+44 1234 567890')).toBeInTheDocument();
    await user.click(card.getByRole('button', { name: 'falcon.coffee' }));
    expect(api.openSupplierWebsite).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('dialog', { name: 'Falcon' })).toBeNull();
  });

  it('copies each detail from its card', async () => {
    const user = userEvent.setup();
    show();
    await user.click(about().getByRole('button', { name: 'Falcon, supplier details' }));
    await user.click(await screen.findByRole('button', { name: 'Copy email' }));
    expect(await navigator.clipboard.readText()).toBe('sales@falcon.coffee');
    expect(screen.getByText('Copied')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy website' }));
    expect(await navigator.clipboard.readText()).toBe('https://www.falcon.coffee');
  });

  it('opens Edit supplier from its card, and Save goes back to the bean', async () => {
    const user = userEvent.setup();
    const { api } = show();
    await user.click(about().getByRole('button', { name: 'Falcon, supplier details' }));
    await user.click(await screen.findByRole('button', { name: 'Edit supplier' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Falcon' }));
    await user.clear(dialog.getByLabelText('Phone'));
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(api.updateSupplier).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('offers Add details on a supplier with nothing to reach it by', async () => {
    const user = userEvent.setup();
    show(
      fakeApi(),
      [{ ...BEAN, supplier: 'Bare', supplierId: 3 }],
      [{ ...FALCON, id: 3, name: 'Bare', website: null, email: null, phone: null }],
    );
    await user.click(about().getByRole('button', { name: 'Bare, supplier details' }));
    expect(await screen.findByText('No website, email or phone yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add details' }));
    expect(await screen.findByLabelText('Website')).toHaveValue('');
  });

  it('says so when its website will not open', async () => {
    const user = userEvent.setup();
    show(
      fakeApi({
        openSupplierWebsite: vi.fn(() => Promise.resolve(err({ kind: 'open-failed' as const }))),
      }),
    );
    await user.click(about().getByRole('button', { name: 'Falcon, supplier details' }));
    await user.click(await screen.findByRole('button', { name: 'falcon.coffee' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't open Falcon's website · see Logs",
    );
  });

  it('is picked from your suppliers in Edit', async () => {
    const user = userEvent.setup();
    const { api } = show();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Supplier' }));
    await user.click(screen.getByRole('option', { name: 'Nordic' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(vi.mocked(api.updateBean).mock.calls[0]?.[0].fields.supplier).toBe('Nordic');
    });
  });

  it('adds a new supplier from what you typed, with the bean, in one step', async () => {
    const user = userEvent.setup();
    const { api } = show();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Supplier' }));
    await user.type(screen.getByRole('combobox', { name: 'Search Supplier' }), 'Aurora');
    await user.click(screen.getByRole('option', { name: 'Add supplier "Aurora"' }));
    expect(screen.getByRole('button', { name: 'Supplier' })).toHaveTextContent('Aurora');
    expect(screen.getByText('New supplier · added when you save')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(vi.mocked(api.updateBean).mock.calls[0]?.[0].fields.supplier).toBe('Aurora');
    });
    expect(api.addSupplier).not.toHaveBeenCalled();
  });

  it('takes a name you have in another case as that supplier', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Supplier' }));
    await user.type(screen.getByRole('combobox', { name: 'Search Supplier' }), 'nordic');
    expect(screen.queryByRole('option', { name: /Add supplier/ })).toBeNull();
  });
});

describe('Suppliers dialog', () => {
  const openDialog = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'More for Beans' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Suppliers' }));
    return within(screen.getByRole('dialog', { name: 'Suppliers' }));
  };

  it('lists your suppliers with how many beans name each, archived ones too', async () => {
    show(fakeApi(), [WITH_FALCON, { ...WITH_FALCON, id: 2, name: 'Old', archived: true }]);
    const dialog = await openDialog();
    const rows = within(dialog.getByRole('list', { name: 'Suppliers' })).getAllByRole('button');
    expect(rows.map((r) => r.textContent)).toEqual([
      'Falcon2 beans · falcon.coffee',
      'Nordic0 beans',
    ]);
  });

  it("changes a supplier's details", async () => {
    const user = userEvent.setup();
    const { api } = show();
    const dialog = await openDialog();
    await user.click(dialog.getByRole('button', { name: /^Falcon/ }));
    const form = within(screen.getByRole('dialog', { name: 'Falcon' }));
    await user.clear(form.getByLabelText('Phone'));
    await user.type(form.getByLabelText('Phone'), '+44 9');
    await user.click(form.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(api.updateSupplier).toHaveBeenCalledWith({
        id: 1,
        fields: { ...FALCON, id: undefined, phone: '+44 9' },
      });
    });
    expect(await screen.findByRole('dialog', { name: 'Suppliers' })).toBeInTheDocument();
  });

  it('says so when the new name is another supplier’s', async () => {
    const user = userEvent.setup();
    show(
      fakeApi({
        updateSupplier: vi.fn(() =>
          Promise.resolve(err({ kind: 'name-taken' as const, name: 'Nordic' })),
        ),
      }),
    );
    const dialog = await openDialog();
    await user.click(dialog.getByRole('button', { name: /^Falcon/ }));
    const form = within(screen.getByRole('dialog', { name: 'Falcon' }));
    await user.clear(form.getByLabelText('Name'));
    await user.type(form.getByLabelText('Name'), 'Nordic');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(await form.findByText('You have a supplier named Nordic')).toBeInTheDocument();
  });

  it('checks a website and an email before Save', async () => {
    const user = userEvent.setup();
    show();
    const dialog = await openDialog();
    await user.click(dialog.getByRole('button', { name: /^Nordic/ }));
    const form = within(screen.getByRole('dialog', { name: 'Nordic' }));
    await user.type(form.getByLabelText('Website'), 'nordic.no');
    expect(form.getByText('Enter a web address, starting with https://')).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('deletes a supplier no bean names, after asking; one with beans says why not', async () => {
    const user = userEvent.setup();
    const { api } = show();
    let dialog = await openDialog();
    await user.click(dialog.getByRole('button', { name: /^Falcon/ }));
    const falcon = within(screen.getByRole('dialog', { name: 'Falcon' }));
    const blocked = falcon.getByRole('button', { name: 'Delete' });
    expect(blocked).toHaveAttribute('aria-disabled', 'true');
    expect(blocked).toHaveAccessibleDescription(
      'Used by 1 bean · pick another supplier on them first',
    );
    await user.click(falcon.getByRole('button', { name: 'Suppliers' }));
    dialog = within(screen.getByRole('dialog', { name: 'Suppliers' }));
    await user.click(dialog.getByRole('button', { name: /^Nordic/ }));
    const nordic = within(screen.getByRole('dialog', { name: 'Nordic' }));
    await user.click(nordic.getByRole('button', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Delete Nordic?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => {
      expect(api.deleteSupplier).toHaveBeenCalledWith(2);
    });
  });

  it('adds a supplier', async () => {
    const user = userEvent.setup();
    const { api } = show(fakeApi(), [BEAN], []);
    const dialog = await openDialog();
    expect(dialog.getByText(/No suppliers yet/)).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Add supplier' }));
    const form = within(screen.getByRole('dialog', { name: 'Add supplier' }));
    await user.type(form.getByLabelText('Name'), 'Aurora');
    await user.type(form.getByLabelText('Email'), 'hi@aurora.example');
    await user.click(form.getByRole('button', { name: 'Add supplier' }));
    await waitFor(() => {
      expect(api.addSupplier).toHaveBeenCalledWith({
        name: 'Aurora',
        website: null,
        email: 'hi@aurora.example',
        phone: null,
        notes: null,
      });
    });
  });
});

describe('Fill from spec sheet and suppliers', () => {
  const AI_ON = { ...ACCEPTED_SETTINGS, ai: { enabled: true, tasteProvider: null } };
  const fillWith = async (fields: Record<string, unknown>, suppliers = [FALCON]) => {
    const api = fakeApi({
      listAiProviders: () => Promise.resolve([withKey(WORDS_AND_SHEETS, '1234')]),
      readSpecSheet: () => Promise.resolve(ok({ status: 'read' as const, fields })),
    });
    renderApp(
      <AddBean onCancel={vi.fn()} onAdded={vi.fn()} />,
      { settings: AI_ON, suppliers },
      api,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Fill from spec sheet' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Fill from spec sheet' }));
    await userEvent.type(dialog.getByLabelText('Paste the sheet'), 'a sheet');
    await userEvent.click(dialog.getByRole('button', { name: 'Fill' }));
    await screen.findByText(/from the sheet · check them/);
    return api;
  };

  it('picks a supplier you have, by name in any case, and offers nothing', async () => {
    await fillWith({ supplier: 'FALCON', supplierWebsite: 'https://elsewhere.example' });
    expect(screen.getByRole('button', { name: 'Supplier' })).toHaveTextContent('Falcon');
    expect(screen.queryByText(/New supplier/)).toBeNull();
  });

  it('offers a new supplier with the website and contacts the sheet gave', async () => {
    const api = await fillWith({
      supplier: 'Nordic Approach',
      supplierWebsite: 'https://nordicapproach.no',
      supplierEmail: 'hello@nordicapproach.no',
    });
    expect(screen.getByRole('button', { name: 'Supplier' })).toHaveTextContent('Nordic Approach');
    expect(
      screen.getByText('New supplier Nordic Approach with its website and email from the sheet'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add supplier' }));
    expect(api.addSupplier).toHaveBeenCalledWith({
      name: 'Nordic Approach',
      website: 'https://nordicapproach.no',
      email: 'hello@nordicapproach.no',
      phone: null,
      notes: null,
    });
    expect(await screen.findByText('Added Nordic Approach to your suppliers')).toBeInTheDocument();
  });

  it('says so when the new supplier could not be added', async () => {
    const api = await fillWith({ supplier: 'Nordic Approach' });
    api.addSupplier = vi.fn(() =>
      Promise.resolve(err({ kind: 'storage-failed' as const, message: 'disk' })),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add supplier' }));
    expect(await screen.findByText("Couldn't add the supplier · see Logs")).toBeInTheDocument();
  });
});
