import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CoachCard } from './CoachCard';
import type { CoachChange } from './CoachChanges';

const HEATER: CoachChange = { name: 'Heater', from: 65, to: 75, tone: 'heat' };
const FAN: CoachChange = { name: 'Fan', from: 50, to: 40, tone: 'air' };

describe('CoachCard', () => {
  it('shows the change and reason, and fires Apply and Dismiss', async () => {
    const onApply = vi.fn();
    const onDismiss = vi.fn();
    render(
      <CoachCard
        changes={[HEATER]}
        reason="4 °C below target, RoR falling"
        onApply={onApply}
        onDismiss={onDismiss}
      />,
    );
    const card = screen.getByRole('region', { name: 'Coach suggestion' });
    expect(card).toHaveTextContent('Coach suggests');
    expect(card).toHaveTextContent(/Heater\s*from 65%\s*to 75%/);
    expect(card).toHaveTextContent('4 °C below target, RoR falling');

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('says when the profile needs calibration', () => {
    render(
      <CoachCard
        changes={[HEATER]}
        reason="Maillard from 150 °C"
        note="needs calibration"
        onApply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Coach suggests · needs calibration')).toBeInTheDocument();
  });

  it('a heads-up has its line and Dismiss, and nothing to apply', async () => {
    const onDismiss = vi.fn();
    render(
      <CoachCard variant="heads-up" line="First crack in ~45 s · listen" onDismiss={onDismiss} />,
    );
    const card = screen.getByRole('region', { name: 'Coach heads-up' });
    expect(card).toHaveTextContent('Heads-up');
    expect(card).toHaveTextContent('First crack in ~45 s · listen');
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('shows each output as a row: name, now, then the target in its colour', () => {
    render(
      <CoachCard
        changes={[HEATER, FAN]}
        reason="Maillard from 150 °C"
        onApply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const rows = screen.getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Heaterfrom 65%to 75%',
      'Fanfrom 50%to 40%',
    ]);
    expect(screen.getByText('75%')).toHaveClass('text-heat');
    expect(screen.getByText('40%')).toHaveClass('text-air');
  });

  it('while applying, Apply says so and cannot be pressed again', async () => {
    const onApply = vi.fn();
    render(
      <CoachCard
        changes={[HEATER]}
        reason="4 °C below target"
        applying
        onApply={onApply}
        onDismiss={vi.fn()}
      />,
    );
    const apply = screen.getByRole('button', { name: 'Applying…' });
    expect(apply).toBeDisabled();
    expect(apply).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(apply);
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeEnabled();
  });
});
