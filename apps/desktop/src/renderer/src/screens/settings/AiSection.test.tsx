import { err, ok, type AiKeys } from '@roastpilot/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ACCEPTED_SETTINGS, fakeApi, renderApp } from '../../test/render-app';
import { AiSection } from './AiSection';
import { whatGoes } from './what-goes';

const none = { saved: false, last4: null };
const claudeOnly: AiKeys = { claude: { saved: true, last4: '1234' }, jev: none };
/** A provider's key row, once the keys are read. */
const keyRow = async (name: 'Claude' | 'Jev') =>
  within(await screen.findByRole('group', { name: `${name} API key` }));

const both: AiKeys = {
  claude: { saved: true, last4: '1234' },
  jev: { saved: true, last4: 'abcd' },
};

function setup(keys: AiKeys = { claude: none, jev: none }, enabled = false) {
  const api = fakeApi({ getAiKeys: () => Promise.resolve(keys) });
  return renderApp(
    <AiSection />,
    { settings: { ...ACCEPTED_SETTINGS, ai: { enabled, tasteProvider: 'claude' } } },
    api,
  );
}

describe('AiSection', () => {
  it('starts off, and the switch waits for a key', async () => {
    setup();
    const toggle = screen.getByRole('switch', { name: 'Use AI to read words and spec sheets' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toBeDisabled();
    expect(screen.getByText('Save a key first')).toBeInTheDocument();
    expect(
      screen.getByText('Roasts, beans and profiles stay on this computer.'),
    ).toBeInTheDocument();
    await screen.findAllByText(/billed to you/);
  });

  it('saves a key, then shows only its last four characters', async () => {
    const { api } = setup();
    const row = await keyRow('Claude');
    const field = row.getByLabelText('Key');
    expect(field).toHaveAttribute('type', 'password');
    await userEvent.type(field, ' sk-ant-abcd1234 ');
    await userEvent.click(row.getByRole('button', { name: 'Save' }));
    expect(api.saveAiKey).toHaveBeenCalledWith({ provider: 'claude', key: 'sk-ant-abcd1234' });
    expect(await screen.findByText('Saved · ends 1234')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('sk-ant-abcd1234')).toBeNull();
  });

  it('waits on Save for a key too short to be one', async () => {
    setup();
    const row = await keyRow('Jev');
    await userEvent.type(row.getByLabelText('Key'), 'short');
    expect(row.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('says why a key was not saved, keeping what you typed', async () => {
    const api = fakeApi({
      getAiKeys: () => Promise.resolve({ claude: none, jev: none }),
      saveAiKey: () => Promise.resolve(err({ kind: 'unsafe-storage' })),
    });
    renderApp(<AiSection />, {}, api);
    const row = await keyRow('Claude');
    const field = row.getByLabelText('Key');
    await userEvent.type(field, 'sk-ant-abcd1234');
    await userEvent.click(row.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText("Can't store the key safely on this computer"),
    ).toBeInTheDocument();
    expect(field).toHaveValue('sk-ant-abcd1234');
  });

  it('turns the helpers on once a key is saved', async () => {
    const { api } = setup(claudeOnly);
    const toggle = screen.getByRole('switch', { name: 'Use AI to read words and spec sheets' });
    await waitFor(() => {
      expect(toggle).toBeEnabled();
    });
    await userEvent.click(toggle);
    expect(api.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ ai: { enabled: true, tasteProvider: 'claude' } }),
    );
  });

  it('removes a key', async () => {
    const api = fakeApi({
      getAiKeys: () => Promise.resolve(claudeOnly),
      removeAiKey: () => Promise.resolve(ok({ claude: none, jev: none })),
    });
    renderApp(<AiSection />, {}, api);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(api.removeAiKey).toHaveBeenCalledWith('claude');
    await waitFor(() => {
      expect(screen.queryByText('Saved · ends 1234')).toBeNull();
    });
  });

  it('lets you choose who reads tasting words only with both keys', async () => {
    const one = setup(claudeOnly);
    expect(screen.getByRole('radiogroup', { name: 'Read tasting words with' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    one.unmount();
    const { api } = setup(both, true);
    await screen.findByText('Saved · ends abcd');
    await userEvent.click(screen.getByRole('radio', { name: 'Jev' }));
    expect(api.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ ai: { enabled: true, tasteProvider: 'jev' } }),
    );
  });

  it('says what goes where for the keys you have', async () => {
    setup(claudeOnly, true);
    expect(
      await screen.findByText(
        'Tasting words and spec sheets go to Anthropic. Roasts, beans and profiles stay on this computer.',
      ),
    ).toBeInTheDocument();
  });
});

describe('whatGoes', () => {
  const stays = 'Roasts, beans and profiles stay on this computer.';
  it.each([
    [{ claude: none, jev: none }, 'claude', stays],
    [
      { claude: none, jev: { saved: true, last4: 'abcd' } },
      'claude',
      `Tasting words go to TypeSafe. ${stays}`,
    ],
    [both, 'jev', `Tasting words go to TypeSafe, spec sheets to Anthropic. ${stays}`],
    [both, 'claude', `Tasting words and spec sheets go to Anthropic. ${stays}`],
  ] as const)('%j reading with %s', (keys, provider, line) => {
    expect(whatGoes(keys, provider)).toBe(line);
  });
});
