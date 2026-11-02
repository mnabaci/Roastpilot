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
    expect(card).toHaveTextContent('Heater 65% → 75%');
    expect(card).toHaveTextContent('4 °C below target, RoR falling');

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
