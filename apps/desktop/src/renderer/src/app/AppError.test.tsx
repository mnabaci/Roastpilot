import { createLogger } from '@roastpilot/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from './AppError';

const deps = () => {
  const write = vi.fn();
  return {
    api: {
      emergencyStop: vi.fn(() => Promise.resolve()),
      openLogFolder: vi.fn(() => Promise.resolve()),
    },
    logger: createLogger({ write }, 'renderer'),
    write,
  };
};

describe('AppError', () => {
  it('says the app hit a problem, with Reload and the log folder', async () => {
    const { api, logger } = deps();
    render(<AppError error={new Error('boom')} connected={false} api={api} logger={logger} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Roastpilot hit a problem');
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Emergency stop' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open log folder' }));
    expect(api.openLogFolder).toHaveBeenCalledOnce();
  });

  it('keeps Emergency stop while a roaster is connected', async () => {
    const { api, logger } = deps();
    render(<AppError error={new Error('boom')} connected api={api} logger={logger} />);
    await userEvent.click(screen.getByRole('button', { name: 'Emergency stop' }));
    expect(api.emergencyStop).toHaveBeenCalledOnce();
  });

  it('logs a failed Emergency stop instead of hiding it', async () => {
    const { api, logger, write } = deps();
    api.emergencyStop.mockRejectedValueOnce(new Error('ipc down'));
    render(<AppError error={new Error('boom')} connected api={api} logger={logger} />);
    await userEvent.click(screen.getByRole('button', { name: 'Emergency stop' }));
    await vi.waitFor(() => {
      expect(write).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', event: 'emergency-stop.failed' }),
      );
    });
  });
});
