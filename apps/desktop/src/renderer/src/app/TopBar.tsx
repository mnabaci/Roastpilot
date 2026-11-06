import type { ConnectionState, Screen } from '@roastpilot/shared';
import { Button, cn, Mark } from '@roastpilot/ui';
import { OctagonX } from 'lucide-react';
import { useConnection, useRoast } from '../stores/use-stores';
import { useDeps } from './app-context';
import { useRun } from '../features/use-run';
import { targetLabel } from './connection-label';
import { PHASE_LABEL } from './phase-label';

const CONNECTION_LABEL: Readonly<Record<ConnectionState['status'], string>> = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  lost: 'Connection lost',
};

/** The Roasters tab's dot: grey off, cyan (air) connected, ember while connecting or lost. */
const DOT: Readonly<Record<ConnectionState['status'], string>> = {
  disconnected: 'bg-ink-muted',
  connecting: 'bg-heat',
  connected: 'bg-air',
  lost: 'bg-heat',
};

const SCREENS: readonly { id: Screen; label: string }[] = [
  { id: 'roast', label: 'Roast' },
  { id: 'history', label: 'History' },
  { id: 'beans', label: 'Beans' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'roasters', label: 'Roasters' },
  { id: 'settings', label: 'Settings' },
  { id: 'logs', label: 'Logs' },
];

/**
 * Status, navigation and an Emergency stop on every screen. It is disabled only while no roaster
 * is connected, as there is nothing to stop; connecting and lost keep it live.
 */
export function TopBar({
  screen,
  onNavigate,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  const { api } = useDeps();
  const run = useRun();
  const connection = useConnection((s) => s.connection);
  const { status } = connection;
  const phase = useRoast((s) => s.roast.phase);
  return (
    <header className="flex items-center gap-4 border-b border-border px-6 py-3">
      <Mark withName />
      <nav aria-label="Screens" className="flex gap-1">
        {SCREENS.map(({ id, label }) => (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            aria-current={screen === id ? 'page' : undefined}
            // Tabs, not actions: the other screens stay muted so the current one stands out.
            className={
              screen === id ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:text-ink'
            }
            onClick={() => {
              onNavigate(id);
            }}
          >
            {label}
            {id === 'roasters' ? (
              <span
                aria-hidden="true"
                title={CONNECTION_LABEL[status]}
                className={cn('size-2 rounded-full', DOT[status])}
              />
            ) : null}
          </Button>
        ))}
      </nav>
      {/* The dot is for the eye; this says it to screen readers. */}
      <p className="sr-only" aria-live="polite">
        {CONNECTION_LABEL[status]}
      </p>
      {connection.status !== 'disconnected' ? (
        // On a wide window the roaster in use and the phase follow the tabs.
        <p className="hidden items-center gap-2 text-label whitespace-nowrap text-ink-muted lg:flex">
          <span className="text-ink">{targetLabel(connection.target)}</span>
          {status === 'connected' ? <span>· {PHASE_LABEL[phase]}</span> : null}
        </p>
      ) : null}
      <Button
        variant="danger"
        className="ml-auto whitespace-nowrap"
        icon={<OctagonX aria-hidden="true" />}
        disabled={status === 'disconnected'}
        onClick={() => {
          run('emergency-stop.failed', () => api.emergencyStop());
        }}
      >
        Emergency stop
      </Button>
    </header>
  );
}
