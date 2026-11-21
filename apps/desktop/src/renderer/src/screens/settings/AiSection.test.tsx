import { err, ok, type AiProviderEntry, type Settings } from '@roastpilot/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WORDS_AND_SHEETS, WORDS_ONLY, withKey } from '../../test/ai-providers';
import { ACCEPTED_SETTINGS, fakeApi, renderApp } from '../../test/render-app';
import { AiSection } from './AiSection';
import { whatGoes } from './what-goes';

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
    const toggle = screen.getByRole('switch', { name: 'Use AI to read words and spec sheets' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toBeDisabled();
    expect(screen.getByText('Save a key first')).toBeInTheDocument();
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
    const toggle = screen.getByRole('switch', { name: 'Use AI to read words and spec sheets' });
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
    const { api } = setup(both, { enabled: true });
    await screen.findByText('Saved · ends abcd');
    expect(screen.getByText('Spec sheets use Alpha')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(api.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ ai: { enabled: true, tasteProvider: 'beta' } }),
    );
  });

  it('offers no choice with only one provider that reads tasting words', async () => {
    setup([WORDS_AND_SHEETS]);
    await keyRow('Alpha');
    expect(screen.queryByRole('radiogroup', { name: 'Read tasting words with' })).toBeNull();
  });
});

describe('whatGoes', () => {
  const stays = 'Roasts, beans and profiles stay on this computer.';
  it.each([
    ['no keys', [WORDS_AND_SHEETS, WORDS_ONLY], null, stays],
    [
      'one provider for both',
      firstOnly,
      null,
      `Tasting words and spec sheets go to Alpha Labs. ${stays}`,
    ],
    [
      'tasting words to the chosen one',
      both,
      'beta',
      `Tasting words go to Beta Inc, spec sheets to Alpha Labs. ${stays}`,
    ],
    [
      'only tasting words',
      [WORDS_AND_SHEETS, withKey(WORDS_ONLY, 'abcd')],
      null,
      `Tasting words go to Beta Inc. ${stays}`,
    ],
  ] as const)('%s', (_name, providers, chosen, line) => {
    expect(whatGoes(providers, chosen)).toBe(line);
  });
});
