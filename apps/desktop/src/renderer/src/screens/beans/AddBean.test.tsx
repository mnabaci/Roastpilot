import { err, ok, type AiKeys, type RoastpilotApi, type Settings } from '@roastpilot/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ACCEPTED_SETTINGS, fakeApi, renderApp } from '../../test/render-app';
import { AddBean } from './AddBean';

const none = { saved: false, last4: null };
const CLAUDE: AiKeys = { claude: { saved: true, last4: '1234' }, jev: none };
const AI_ON: Settings = { ...ACCEPTED_SETTINGS, ai: { enabled: true, tasteProvider: 'claude' } };

function setup(
  overrides: Partial<RoastpilotApi> = {},
  { settings = AI_ON, keys = CLAUDE }: { settings?: Settings; keys?: AiKeys } = {},
) {
  const api = fakeApi({ getAiKeys: () => Promise.resolve(keys), ...overrides });
  return renderApp(<AddBean onCancel={vi.fn()} onAdded={vi.fn()} />, { settings }, api);
}

const openDialog = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Fill from spec sheet' }));
  return within(await screen.findByRole('dialog', { name: 'Fill from spec sheet' }));
};

describe('Fill from spec sheet on Add bean', () => {
  it('is not offered while the AI helpers are off, or without a Claude key', async () => {
    const off = setup({}, { settings: ACCEPTED_SETTINGS });
    await off.findByRole('button', { name: 'Add bean' });
    expect(screen.queryByRole('button', { name: 'Fill from spec sheet' })).toBeNull();
    off.unmount();
    setup({}, { keys: { claude: none, jev: { saved: true, last4: 'abcd' } } });
    await screen.findByRole('button', { name: 'Add bean' });
    expect(screen.queryByRole('button', { name: 'Fill from spec sheet' })).toBeNull();
  });

  it('fills empty fields from pasted text, saves nothing, and says how many', async () => {
    const { api } = setup({
      readSpecSheet: () =>
        Promise.resolve(
          ok({ status: 'read', fields: { name: 'Guji', origin: 'Ethiopia', altitudeM: 1900 } }),
        ),
    });
    const dialog = await openDialog();
    await userEvent.type(dialog.getByLabelText('Paste the sheet'), 'Guji, Ethiopia, 1900 m');
    await userEvent.click(dialog.getByRole('button', { name: 'Fill' }));
    expect(api.readSpecSheet).toHaveBeenCalledWith({
      kind: 'text',
      text: 'Guji, Ethiopia, 1900 m',
    });
    expect(
      await screen.findByText('Filled 3 fields from the sheet · check them, then Save'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Origin')).toHaveValue('Ethiopia');
    expect(api.addBean).not.toHaveBeenCalled();
  });

  it('asks main for a PDF, and does nothing when you cancel its dialog', async () => {
    const { api } = setup({ readSpecSheet: () => Promise.resolve(ok({ status: 'cancelled' })) });
    const dialog = await openDialog();
    await userEvent.click(dialog.getByRole('button', { name: 'Choose PDF…' }));
    expect(api.readSpecSheet).toHaveBeenCalledWith({ kind: 'pdf' });
    expect(screen.getByRole('dialog', { name: 'Fill from spec sheet' })).toBeInTheDocument();
    expect(screen.queryByText(/Filled/)).toBeNull();
  });

  it('says why a read failed and keeps the dialog open with your text', async () => {
    setup({
      readSpecSheet: () => Promise.resolve(err({ kind: 'too-long', limit: '20 pages' })),
    });
    const dialog = await openDialog();
    await userEvent.type(dialog.getByLabelText('Paste the sheet'), 'a sheet');
    await userEvent.click(dialog.getByRole('button', { name: 'Fill' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Too long · up to 20 pages');
    expect(dialog.getByLabelText('Paste the sheet')).toHaveValue('a sheet');
  });

  it('says when a sheet has nothing to fill', async () => {
    setup({ readSpecSheet: () => Promise.resolve(ok({ status: 'read', fields: {} })) });
    const dialog = await openDialog();
    await userEvent.type(dialog.getByLabelText('Paste the sheet'), 'hello');
    await userEvent.click(dialog.getByRole('button', { name: 'Fill' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Nothing to fill from that sheet');
  });

  it('waits on Fill until something is pasted', async () => {
    setup();
    const dialog = await openDialog();
    expect(dialog.getByRole('button', { name: 'Fill' })).toBeDisabled();
  });
});
