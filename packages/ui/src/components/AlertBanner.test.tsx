import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AlertBanner } from './AlertBanner';

describe('AlertBanner', () => {
  it('announces critical alerts assertively', () => {
    render(
      <AlertBanner kind="critical">
        Emergency stop · heater off, fan and bean cooler on
      </AlertBanner>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Emergency stop · heater off, fan and bean cooler on',
    );
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

  it('can label its button for the case, e.g. Acknowledge', async () => {
    const onDismiss = vi.fn();
    render(
      <AlertBanner kind="critical" onDismiss={onDismiss} dismissLabel="Acknowledge">
        Heater locked
      </AlertBanner>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('says why something waits as a polite status, never an alert', () => {
    render(
      <AlertBanner kind="info">Auto is running this profile · edits save after Drop</AlertBanner>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Auto is running this profile · edits save after Drop',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
