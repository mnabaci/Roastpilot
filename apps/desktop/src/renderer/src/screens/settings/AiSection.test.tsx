import { err, ok, type AiProviderEntry, type Settings } from '@roastpilot/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WORDS_AND_SHEETS, WORDS_ONLY, withKey } from '../../test/ai-providers';
import { ACCEPTED_SETTINGS, fakeApi, renderApp } from '../../test/render-app';
import { AiSection } from './AiSection';
import { jobLine } from './who-reads';

const both = [withKey(WORDS_AND_SHEETS, '1234'), withKey(WORDS_ONLY, 'abcd')];
const firstOnly = [withKey(WORDS_AND_SHEETS, '1234'), WORDS_ONLY];

function setup(
  providers: readonly AiProviderEntry[] = [WORDS_AND_SHEETS, WORDS_ONLY],
  { enabled = false, tasteProvider = null }: Partial<Settings['ai']> = {},
  overrides: Parameters<typeof fakeApi>[0] = {},
) {
  const api = fakeApi({ listAiProviders: () => Promise.resolve([...providers]), ...overrides });
  return renderApp(
    <AiSection />,
    { settings: { ...ACCEPTED_SETTINGS, ai: { enabled, tasteProvider } } },
    api,
  );
}

/** A provider's key row, named as the provider names itself, once the list is read. */
const keyRow = async (label: string) =>
  within(await screen.findByRole('group', { name: `${label} API key` }));

describe('AiSection', () => {
  it('lists the providers main sends, as they describe themselves', async () => {
    setup();
    const row = await keyRow('Alpha');
    expect(row.getByText('From keys.alpha.example · billed to you')).toBeInTheDocument();
    expect(await keyRow('Beta')).toBeTruthy();
  });

  it('starts off, and the switch waits for a key', async () => {
    setup();
    await keyRow('Alpha');
    const toggle = screen.getByRole('switch', { name: 'Use AI helpers' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/· save a key first$/)).toBeInTheDocument();
    expect(
      screen.getByText('Roasts, beans and profiles stay on this computer.'),
    ).toBeInTheDocument();
  });

  it('saves a key, then shows only its last four characters', async () => {
    const { api } = setup(
      [WORDS_AND_SHEETS],
      {},
      {
        saveAiKey: () => Promise.resolve(ok([withKey(WORDS_AND_SHEETS, '1234')])),
      },
    );
    const row = await keyRow('Alpha');
    const field = row.getByLabelText('Key');
    expect(field).toHaveAttribute('type', 'password');
    await userEvent.type(field, ' sk-ant-abcd1234 ');
    await userEvent.click(row.getByRole('button', { name: 'Save' }));
    expect(api.saveAiKey).toHaveBeenCalledWith({ provider: 'alpha', key: 'sk-ant-abcd1234' });
    expect(await screen.findByText('Saved · ends 1234')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('sk-ant-abcd1234')).toBeNull();
  });

  it('waits on Save for a key too short to be one', async () => {
    setup();
    const row = await keyRow('Beta');
    await userEvent.type(row.getByLabelText('Key'), 'short');
    expect(row.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('says why a key was not saved, keeping what you typed', async () => {
    setup(
      [WORDS_AND_SHEETS],
      {},
      {
        saveAiKey: () => Promise.resolve(err({ kind: 'unsafe-storage' })),
      },
    );
    const row = await keyRow('Alpha');
    const field = row.getByLabelText('Key');
    await userEvent.type(field, 'sk-ant-abcd1234');
    await userEvent.click(row.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText("Can't store the key safely on this computer"),
    ).toBeInTheDocument();
    expect(field).toHaveValue('sk-ant-abcd1234');
  });

  it('turns the helpers on once a key is saved', async () => {
    const { api } = setup(firstOnly);
    await screen.findByText('Saved · ends 1234');
    const toggle = screen.getByRole('switch', { name: 'Use AI helpers' });
    await userEvent.click(toggle);
    expect(api.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ ai: { enabled: true, tasteProvider: null } }),
    );
  });

  it('removes a key once you confirm', async () => {
    const { api } = setup(
      firstOnly,
      {},
      {
        removeAiKey: () => Promise.resolve(ok([WORDS_AND_SHEETS, WORDS_ONLY])),
      },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(api.removeAiKey).not.toHaveBeenCalled();
    const dialog = within(await screen.findByRole('alertdialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Remove' }));
    expect(api.removeAiKey).toHaveBeenCalledWith('alpha');
    await waitFor(() => {
      expect(screen.queryByText('Saved · ends 1234')).toBeNull();
    });
  });

  it('replaces a saved key, keeping it until Save, or leaves it on Cancel', async () => {
    const { api } = setup(firstOnly);
    const row = await keyRow('Alpha');
    await userEvent.click(await row.findByRole('button', { name: 'Replace' }));
    await userEvent.click(row.getByRole('button', { name: 'Cancel' }));
    expect(await row.findByText('Saved · ends 1234')).toBeInTheDocument();
    await userEvent.click(row.getByRole('button', { name: 'Replace' }));
    await userEvent.type(row.getByLabelText('Key'), 'sk-ant-new-9999');
    await userEvent.click(row.getByRole('button', { name: 'Save' }));
    expect(api.saveAiKey).toHaveBeenCalledWith({ provider: 'alpha', key: 'sk-ant-new-9999' });
    expect(api.removeAiKey).not.toHaveBeenCalled();
  });

  it('explains each helper behind an ⓘ: what it does, where, and what it sends', async () => {
    setup([WORDS_AND_SHEETS, withKey(WORDS_ONLY, 'abcd')], { tasteProvider: 'alpha' });
    await screen.findByText('Saved · ends abcd');
    await userEvent.click(screen.getByRole('button', { name: 'About tasting words' }));
    const taste = await screen.findByRole('dialog', { name: 'About tasting words' });
    expect(taste).toHaveTextContent('History › a roast › Roast details › Taste');
    expect(taste).toHaveTextContent('Sends only those words, up to 500 characters.');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'About tasting words' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'About spec sheets' }));
    expect(await screen.findByRole('dialog', { name: 'About spec sheets' })).toHaveTextContent(
      'Fill details, from a spec sheet or its order page',
    );
  });

  it('shows the reader actually used when only one has a key', async () => {
    setup([WORDS_AND_SHEETS, withKey(WORDS_ONLY, 'abcd')], { tasteProvider: 'alpha' });
    await screen.findByText('Saved · ends abcd');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radiogroup', { name: 'Read tasting words with' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('lets you choose who reads tasting words with two keys', async () => {
    const { api } = setup(both, { enabled: true, tasteProvider: 'beta' });
    await screen.findByText('Saved · ends abcd');
    const card = within(screen.getByRole('region', { name: 'Who reads what' }));
    expect(card.getByText('To Beta Inc · Beta 3')).toBeInTheDocument();
    expect(card.getByText('To Alpha Labs · Alpha Max')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Alpha' }));
    expect(api.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ ai: { enabled: true, tasteProvider: 'alpha' } }),
    );
  });

  it('says where each job goes and which model reads it', async () => {
    setup(firstOnly);
    const card = within(await screen.findByRole('region', { name: 'Who reads what' }));
    // The control shows who reads them; a second key would let you choose.
    expect(
      card.getByText('To Alpha Labs · Alpha Mini · a second key lets you choose'),
    ).toBeInTheDocument();
    expect(card.getByRole('radiogroup', { name: 'Read tasting words with' })).toBeInTheDocument();
    expect(card.getByText('To Alpha Labs · Alpha Max')).toBeInTheDocument();
  });

  it('shows a dash, not a choice, while no provider that reads tasting words has a key', async () => {
    setup();
    const card = within(await screen.findByRole('region', { name: 'Who reads what' }));
    expect(card.queryByRole('radiogroup', { name: 'Read tasting words with' })).toBeNull();
    expect(card.getAllByText('Nothing sent · add a key that reads them')).toHaveLength(2);
    expect(card.getAllByText('–')).toHaveLength(2);
  });

  it('says nothing is sent for a job no key reads', async () => {
    setup([WORDS_AND_SHEETS, withKey(WORDS_ONLY, 'abcd')]);
    const card = within(await screen.findByRole('region', { name: 'Who reads what' }));
    expect(
      card.getByText('To Beta Inc · Beta 3 · a second key lets you choose'),
    ).toBeInTheDocument();
    expect(card.getByText('Nothing sent · add a key that reads them')).toBeInTheDocument();
    expect(card.getByText('–')).toBeInTheDocument();
  });

  it('offers no choice with only one provider that reads tasting words', async () => {
    setup([withKey(WORDS_AND_SHEETS, '1234')]);
    await keyRow('Alpha');
    expect(screen.queryByRole('radiogroup', { name: 'Read tasting words with' })).toBeNull();
    // It names the one that reads them instead, with where they go.
    expect(screen.getAllByText('Alpha')).toHaveLength(2);
    expect(screen.getByText('To Alpha Labs · Alpha Mini')).toBeInTheDocument();
  });

  it('shows no spec sheet row when no provider reads sheets', async () => {
    setup([withKey(WORDS_ONLY, 'abcd')]);
    const card = within(await screen.findByRole('region', { name: 'Who reads what' }));
    expect(card.queryByRole('heading', { name: 'Spec sheets' })).toBeNull();
    expect(card.getByRole('heading', { name: 'Tasting words' })).toBeInTheDocument();
  });
});

describe('jobLine', () => {
  it('names the company and the model as the provider says them', () => {
    expect(jobLine(withKey(WORDS_AND_SHEETS, '1234'), 'specSheet')).toBe(
      'To Alpha Labs · Alpha Max',
    );
  });

  it('says nothing is sent with no reader, or one without that job', () => {
    expect(jobLine(undefined, 'taste')).toBe('Nothing sent · add a key that reads them');
    expect(jobLine(withKey(WORDS_ONLY, 'abcd'), 'specSheet')).toBe(
      'Nothing sent · add a key that reads them',
    );
  });
});
