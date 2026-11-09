import { updateWaiting, type ConnectionState, type Screen } from '@roastpilot/shared';
import { Button, cn, Mark, Tooltip } from '@roastpilot/ui';
import type { ReactElement } from 'react';
import { OctagonX } from 'lucide-react';
import { activeRoaster } from '../stores/roasters-store';
import { useConnection, useRoast, useRoasters, useUpdates } from '../stores/use-stores';
import { useDeps } from './app-context';
import { useRun } from '../features/use-run';
import { connectedName } from './connection-label';
import { PHASE_LABEL } from './phase-label';
import { SCREENS } from './screen-label';

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
  const roaster = useRoasters((s) => activeRoaster(s.roasters));
  const updateDot = useUpdates((s) => s.status !== null && updateWaiting(s.status));
  return (
    <header className="flex items-center gap-4 border-b border-border px-6 py-3">
      <Mark withName />
      <nav aria-label="Screens" className="flex gap-1">
        {SCREENS.map(({ id, label }) => (
          <DotTip
            key={id}
            content={
              id === 'roasters'
                ? CONNECTION_LABEL[status]
                : id === 'settings' && updateDot
                  ? 'Update available'
                  : undefined
            }
          >
            <Button
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
                <span aria-hidden="true" className={cn('size-2 rounded-full', DOT[status])} />
              ) : null}
              {id === 'settings' && updateDot ? (
                // An update is ready or out: ember, like anything waiting for you.
                <span aria-hidden="true" className="size-2 rounded-full bg-heat" />
              ) : null}
            </Button>
          </DotTip>
        ))}
      </nav>
      {/* The dot is for the eye; this says it to screen readers. */}
      <p className="sr-only" aria-live="polite">
        {CONNECTION_LABEL[status]}
      </p>
      <p className="sr-only" aria-live="polite">
        {updateDot ? 'Update available' : ''}
      </p>
      {connection.status !== 'disconnected' ? (
        // On a wide window the roaster in use (its name; the port is on Roasters) and the phase.
        <p className="hidden items-center gap-2 text-label whitespace-nowrap text-ink-muted lg:flex">
          <span className="text-ink">{connectedName(connection.target, roaster)}</span>
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

/** A tab with a dot says what the dot means, on hover or focus, in the app's tooltip. */
function DotTip({ content, children }: { content: string | undefined; children: ReactElement }) {
  return content === undefined ? children : <Tooltip content={content}>{children}</Tooltip>;
}
