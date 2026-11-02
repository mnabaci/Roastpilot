import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhaseStepper } from './PhaseStepper';

const steps = ['Preheat', 'Roast', 'First crack', 'Drop', 'Cool'] as const;

describe('PhaseStepper', () => {
  it('marks the current step and the done steps', () => {
    render(<PhaseStepper steps={steps} current={2} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).toHaveTextContent('Preheat (done)');
    expect(items[3]).not.toHaveTextContent('(done)');
  });
});
