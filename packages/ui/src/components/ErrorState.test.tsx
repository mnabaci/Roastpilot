import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('says what broke and why, in one alert', () => {
    render(
      <ErrorState
        title="Settings hit a problem"
        detail="Cannot read properties of undefined"
        onReload={vi.fn()}
        onOpenLogs={vi.fn()}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Settings hit a problem');
    expect(alert).toHaveTextContent('Cannot read properties of undefined');
  });

  it('reloads and opens the log folder', async () => {
    const onReload = vi.fn();
    const onOpenLogs = vi.fn();
    render(
      <ErrorState title="History hit a problem" onReload={onReload} onOpenLogs={onOpenLogs} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open log folder' }));
    expect(onReload).toHaveBeenCalledOnce();
    expect(onOpenLogs).toHaveBeenCalledOnce();
  });

  it('puts what comes before Reload above it', () => {
    render(
      <ErrorState
        title="Roastpilot hit a problem"
        onReload={vi.fn()}
        onOpenLogs={vi.fn()}
        before={<button type="button">Emergency stop</button>}
      />,
    );
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Emergency stop', 'Reload', 'Open log folder']);
  });
});
