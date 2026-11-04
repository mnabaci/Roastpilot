import type { ConnectionState, RoastPhase, Screen } from '@roastpilot/shared';
import { Badge, Button } from '@roastpilot/ui';
import { OctagonX } from 'lucide-react';
import { useConnection, useRoast } from '../stores/use-stores';
import { useDeps } from './app-context';
import { useRun } from '../features/use-run';
import { targetLabel } from './connection-label';

const CONNECTION_LABEL: Readonly<Record<ConnectionState['status'], string>> = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  lost: 'Connection lost',
};

const PHASE_LABEL: Readonly<Record<RoastPhase, string>> = {
  ready: 'Ready',
  preheat: 'Preheat',
  roasting: 'Roasting',
  development: 'Development',
  cooling: 'Cooling',
  done: 'Done',
};

const SCREENS: readonly { id: Screen; label: string }[] = [
  { id: 'roast', label: 'Roast' },
  { id: 'history', label: 'History' },
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
          </Button>
        ))}
      </nav>
      <p className="flex items-center gap-2 text-label text-ink-muted" aria-live="polite">
        <Badge tone={status === 'connected' ? 'air' : status === 'lost' ? 'heat' : 'neutral'}>
          {CONNECTION_LABEL[status]}
        </Badge>
        {connection.status !== 'disconnected' ? (
          <span className="text-ink">{targetLabel(connection.target)}</span>
        ) : null}
        {status === 'connected' ? <span>· {PHASE_LABEL[phase]}</span> : null}
      </p>
      <Button
        variant="danger"
        className="ml-auto"
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
