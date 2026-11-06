import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SidebarLayout } from './SidebarLayout';

describe('SidebarLayout', () => {
  it('puts the title and list in a named sidebar and the open item in a named region', () => {
    render(
      <SidebarLayout title="Settings" contentLabel="Roast" sidebar={<p>list</p>}>
        <p>rows</p>
      </SidebarLayout>,
    );
    const sidebar = screen.getByRole('navigation', { name: 'Settings' });
    expect(sidebar).toContainElement(screen.getByRole('heading', { level: 1, name: 'Settings' }));
    expect(sidebar).toContainElement(screen.getByText('list'));
    expect(screen.getByRole('region', { name: 'Roast' })).toContainElement(
      screen.getByText('rows'),
    );
  });
});
