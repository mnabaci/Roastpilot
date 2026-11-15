import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhaseSplit } from './PhaseSplit';

describe('PhaseSplit', () => {
  it('names each phase with its length and share, saying the spoken detail where given', () => {
    render(
      <PhaseSplit
        parts={[
          {
            key: 'drying',
            label: 'Drying',
            detail: '≈ 4:24 · 40 %',
            spokenDetail: 'about 4:24, 40 %',
            share: 0.4,
            tone: 'low',
          },
          {
            key: 'development',
            label: 'Development',
            detail: '2:00 · 18 %',
            end: 'to 208.5 °C',
            share: 0.18,
            tone: 'high',
          },
        ]}
      />,
    );
    const group = screen.getByRole('group', { name: 'Phases' });
    expect(group).toHaveTextContent('Drying');
    expect(screen.getByText('about 4:24, 40 %')).toHaveClass('sr-only');
    expect(screen.getByText('≈ 4:24 · 40 %')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('2:00 · 18 %')).not.toHaveAttribute('aria-hidden');
    expect(group).toHaveTextContent('to 208.5 °C');
  });

  it('shows nothing with no phases', () => {
    const { container } = render(<PhaseSplit parts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
