import type { ConnectionState, RoastPhase } from '@roastpilot/shared';
import { Badge, Button } from '@roastpilot/ui';
import { OctagonX } from 'lucide-react';
import { useAppState, useDeps } from '../state/app-context';
import { useRun } from '../hooks/use-run';

export type Screen = 'roast' | 'settings';

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
  { id: 'settings', label: 'Settings' },
];

/** Status, navigation and an Emergency stop that is on every screen, connected or not. */
export function TopBar({
  screen,
  onNavigate,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  const { api } = useDeps();
  const run = useRun();
  const status = useAppState((s) => s.connection.status);
  const phase = useAppState((s) => s.roast.phase);
  return (
    <header className="flex items-center gap-4 border-b border-border px-6 py-3">
      <nav aria-label="Screens" className="flex gap-1">
        {SCREENS.map(({ id, label }) => (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            aria-current={screen === id ? 'page' : undefined}
            className={screen === id ? 'bg-surface-raised text-ink' : undefined}
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
        {status === 'connected' ? <span>{PHASE_LABEL[phase]}</span> : null}
      </p>
      <Button
        variant="danger"
        className="ml-auto"
        icon={<OctagonX aria-hidden="true" />}
        onClick={() => {
          run('emergency-stop.failed', () => api.emergencyStop());
        }}
      >
        Emergency stop
      </Button>
    </header>
  );
}
