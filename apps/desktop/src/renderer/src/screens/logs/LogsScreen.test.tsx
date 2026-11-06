import type { LogDayRead, LogRecord } from '@roastpilot/shared';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, renderApp } from '../../test/render-app';
import { localDay } from './log-days';
import { LogsScreen } from './LogsScreen';

const r = (
  event: string,
  level: LogRecord['level'],
  scope = 'app.session',
  context?: unknown,
): LogRecord => ({
  time: '2026-11-03T10:15:30.000Z',
  level,
  scope,
  event,
  ...(context === undefined ? {} : { context }),
});

const DAY: LogDayRead = {
  records: [
    r('app.started', 'info', 'app'),
    r('session.connect-failed', 'warn', 'app.session', { error: { kind: 'no-reply' } }),
    r('safety.tripped', 'error', 'app.session', { rule: 'max-temperature' }),
  ],
  unreadable: 0,
  truncated: false,
};

function setup(read: Partial<LogDayRead> = {}, overrides = {}) {
  let push: (records: LogRecord[]) => void = () => undefined;
  const api = fakeApi({
    listLogDays: vi.fn(() => Promise.resolve([localDay(new Date()), '2026-10-30'])),
    readLogDay: vi.fn(() => Promise.resolve({ ...DAY, ...read })),
    onLogEntries: vi.fn((listener: (records: LogRecord[]) => void) => {
      push = listener;
      return () => undefined;
    }),
    ...overrides,
  });
  const view = renderApp(<LogsScreen />, {}, api);
  return {
    ...view,
    push: (records: LogRecord[]) => {
      act(() => {
        push(records);
      });
    },
  };
}

const rows = () =>
  within(screen.getByRole('list', { name: 'Log entries' })).getAllByRole('listitem');

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('LogsScreen', () => {
  it("opens on today's errors and warnings, newest first, with counts on the chips", async () => {
    const { api } = setup();
    expect(await screen.findByText('safety.tripped')).toBeInTheDocument();
    expect(api.readLogDay).toHaveBeenCalledWith(localDay(new Date()));
    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('safety.tripped'),
      expect.stringContaining('session.connect-failed'),
    ]);
    expect(screen.getByRole('button', { name: 'Info 1' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('a level chip adds that level', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Info 1' }));
    expect(screen.getByText('app.started')).toBeInTheDocument();
  });

  it('a scope chip narrows to that scope', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Info 1' }));
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Scopes' })).getByRole('button', { name: 'app' }),
    );
    expect(rows()).toHaveLength(1);
  });

  it('search filters by context too', async () => {
    setup();
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search' }), 'no-reply');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('session.connect-failed');
  });

  it('opens an entry to its full context, and copies it', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /safety\.tripped/ }));
    expect(screen.getByText(/"rule": "max-temperature"/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"event": "safety.tripped"'));
  });

  it("today's list gets new entries as they are written", async () => {
    const { push } = setup();
    await screen.findByText('safety.tripped');
    push([r('session.lost', 'error')]);
    expect(rows()[0]).toHaveTextContent('session.lost');
  });

  it('another day reads that day and is not live', async () => {
    const { api } = setup();
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Day' }),
      '2026-10-30',
    );
    expect(api.readLogDay).toHaveBeenLastCalledWith('2026-10-30');
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });

  it('says how many lines were unreadable and when older entries were left out', async () => {
    setup({ unreadable: 3, truncated: true });
    expect(
      await screen.findByText('Showing the newest 2,000 entries · 3 lines unreadable'),
    ).toBeInTheDocument();
  });

  it('a failed read says so in one line', async () => {
    setup({}, { readLogDay: vi.fn(() => Promise.reject(new Error('EACCES'))) });
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't read this day's log");
  });

  it('an empty day says so', async () => {
    setup({ records: [] });
    expect(await screen.findByText('Nothing logged this day')).toBeInTheDocument();
  });

  it('a filter that hides everything says so', async () => {
    setup({ records: [r('app.started', 'info', 'app')] });
    expect(await screen.findByText('No entries match · try more levels')).toBeInTheDocument();
  });

  it('Open log folder asks main to open it', async () => {
    const { api } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'More for Logs' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open log folder' }));
    expect(api.openLogFolder).toHaveBeenCalledOnce();
  });
});
