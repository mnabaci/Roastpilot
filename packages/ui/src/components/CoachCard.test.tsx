import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CoachCard } from './CoachCard';

describe('CoachCard', () => {
  it('shows the change and reason, and fires Apply and Dismiss', async () => {
    const onApply = vi.fn();
    const onDismiss = vi.fn();
    render(
      <CoachCard
        change="Heater 65% → 75%"
        reason="4 °C below target, RoR falling"
        onApply={onApply}
        onDismiss={onDismiss}
      />,
    );
    const card = screen.getByRole('region', { name: 'Coach suggestion' });
    expect(card).toHaveTextContent('Coach suggests');
    expect(card).toHaveTextContent('Heater 65% → 75%');
    expect(card).toHaveTextContent('4 °C below target, RoR falling');

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('says when the profile needs calibration', () => {
    render(
      <CoachCard
        change="Heater 65% → 75%"
        reason="Maillard from 150 °C"
        note="Light · Steps needs calibration"
        onApply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Coach suggests · Light · Steps needs calibration'),
    ).toBeInTheDocument();
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
});
