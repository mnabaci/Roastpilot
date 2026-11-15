import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { renderApp } from '../../test/render-app';
import { reportRoast } from '../../test/report-roast';
import { OpenRoast } from './OpenRoast';

const open = (detail: ReturnType<typeof reportRoast>) =>
  renderApp(
    <OpenRoast
      selected={{ status: 'loaded', detail }}
      compared={{ status: 'none' }}
      compareLabel=""
      live={false}
      beans={[]}
      smoothingS={0}
      showPreheat={false}
      onShowPreheat={vi.fn()}
    />,
  );

describe('OpenRoast › Roast report', () => {
  // jsdom lays nothing out, so it has no scrolling to do: just count the asks.
  let scrollIntoView: MockInstance<Element['scrollIntoView']>;
  beforeEach(() => {
    scrollIntoView = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    scrollIntoView.mockRestore();
  });

  it('shows a finding on the chart when you click it, and lets it go on a second click', async () => {
    open(reportRoast(620, 660));
    const findings = within(await screen.findByRole('list', { name: 'Findings' }));
    const finding = findings.getByRole('button', { name: /Short development/ });
    expect(finding).toHaveAccessibleName(expect.stringMatching(/Show on the chart$/));
    expect(finding).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(finding);
    expect(finding).toHaveAttribute('aria-pressed', 'true');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    await userEvent.click(finding);
    expect(finding).toHaveAttribute('aria-pressed', 'false');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('has no report before drop', () => {
    open(reportRoast(540, null));
    expect(screen.queryByRole('button', { name: 'Roast report' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Roast curve' })).toBeInTheDocument();
  });
});
