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

  it('shows a detail under a step, such as how long it took', () => {
    render(<PhaseStepper steps={steps} current={1} details={['4:10']} />);
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Preheat (done)4:10');
  });

  it('a skipped step says Skipped, not done, even with a detail', () => {
    render(<PhaseStepper steps={steps} current={4} details={['4:10', '8:00']} skipped={[2]} />);
    const items = screen.getAllByRole('listitem');
    expect(items[2]).toHaveTextContent('First crackSkipped');
    expect(items[2]).not.toHaveTextContent('(done)');
    expect(items[3]).toHaveTextContent('Drop (done)');
  });
});
