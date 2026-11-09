import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CollapsibleCard } from './CollapsibleCard';

function Card({ startOpen = true }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <CollapsibleCard
      title="Roast details"
      summary="African Moon · ★★★★★"
      spokenSummary="African Moon · rated 5 of 5"
      open={open}
      onOpenChange={setOpen}
    >
      <label>
        Notes <input />
      </label>
    </CollapsibleCard>
  );
}

describe('CollapsibleCard', () => {
  it('opens with its content and no summary; its header button folds it', async () => {
    render(<Card />);
    const header = screen.getByRole('button', { name: 'Roast details' });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    expect(screen.queryByText('African Moon · ★★★★★')).toBeNull();
    await userEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    // Folding, it is out of reach at once, and gone once it has shrunk.
    expect(screen.getByLabelText('Notes').closest('[inert]')).not.toBeNull();
    await waitFor(() => {
      expect(screen.queryByLabelText('Notes')).toBeNull();
    });
  });

  it('folded, sums up what is inside, spoken in words', () => {
    render(<Card startOpen={false} />);
    const header = screen.getByRole('button', { name: 'Roast details' });
    expect(header).toHaveTextContent('African Moon · ★★★★★');
    expect(header).toHaveAccessibleDescription('African Moon · rated 5 of 5');
    const content = document.getElementById(header.getAttribute('aria-controls') ?? '');
    expect(content).not.toBeNull();
    expect(content).not.toBeVisible();
  });

  it('says when it is asked to open or fold', async () => {
    const onOpenChange = vi.fn();
    render(
      <CollapsibleCard title="Roast details" open={false} onOpenChange={onOpenChange}>
        Inside
      </CollapsibleCard>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Roast details' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
