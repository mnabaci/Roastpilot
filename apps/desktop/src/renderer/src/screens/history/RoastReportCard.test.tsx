import { roastReport, type RoastReport } from '@roastpilot/core';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ACCEPTED_SETTINGS, renderApp } from '../../test/render-app';
import { reportRoast } from '../../test/report-roast';
import { RoastReportCard } from './RoastReportCard';

const report = (fcS: number, dropS: number): RoastReport => {
  const made = roastReport(reportRoast(fcS, dropS));
  if (!made) throw new Error('no report');
  return made;
};

describe('RoastReportCard', () => {
  it('opens by default with the phase split and what stood out', () => {
    renderApp(<RoastReportCard report={report(620, 660)} />);
    expect(screen.getByRole('button', { name: 'Roast report' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const phases = within(screen.getByRole('group', { name: 'Phases' }));
    expect(phases.getByText('Drying')).toBeInTheDocument();
    expect(phases.getByText('Development')).toBeInTheDocument();
    const findings = within(screen.getByRole('list', { name: 'Findings' }));
    expect(findings.getByText('Short development')).toBeInTheDocument();
  });

  it('says so when nothing stood out', () => {
    renderApp(<RoastReportCard report={report(540, 660)} />);
    expect(screen.getByText(/^Nothing stood out/)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Against the plan' })).toBeNull();
  });

  it('folds to one line, and saves that choice for every roast', async () => {
    const { api, stores } = renderApp(<RoastReportCard report={report(620, 660)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Roast report' }));
    expect(screen.getByRole('button', { name: 'Roast report' })).toHaveTextContent(
      /Drying \d+ % · Maillard \d+ % · Development 6 % · 1 note/,
    );
    await waitFor(() => {
      expect(api.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({ historyReportOpen: false }),
      );
    });
    expect(stores.settings.getState().settings.historyReportOpen).toBe(false);
  });

  it('opens folded when you folded it before', () => {
    renderApp(<RoastReportCard report={report(620, 660)} />, {
      settings: { ...ACCEPTED_SETTINGS, historyReportOpen: false },
    });
    expect(screen.getByRole('button', { name: 'Roast report' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
