import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AlertBanner } from './AlertBanner';

describe('AlertBanner', () => {
  it('announces critical alerts assertively', () => {
    render(<AlertBanner kind="critical">Emergency stop · heater off, cooling on</AlertBanner>);
    expect(screen.getByRole('alert')).toHaveTextContent('Emergency stop · heater off, cooling on');
  });

  it('uses a polite status for warnings and can be dismissed', async () => {
    const onDismiss = vi.fn();
    render(
      <AlertBanner kind="warning" onDismiss={onDismiss}>
        Temperature stalled for 60 s
      </AlertBanner>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Temperature stalled for 60 s');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
