import type { RoastAction } from '@roastpilot/shared';
import { Button, formatClock } from '@roastpilot/ui';
import { flowStep, isConnected } from './flow-step';
import { useRun } from '../../features/use-run';
import { useDeps } from '../../app/app-context';
import { useConnection, useRoast } from '../../stores/use-stores';

/** The one next action for the state, with its one-line hint. */
export function FlowPanel({
  coolingLeftS,
  onConnect,
}: {
  coolingLeftS: number | undefined;
  onConnect: () => void;
}) {
  const { api, logger } = useDeps();
  const run = useRun();
  const connected = useConnection((s) => isConnected(s.connection));
  const lost = useConnection((s) => s.connection.status === 'lost');
  const phase = useRoast((s) => s.roast.phase);
  if (lost) {
    // Main is already reopening the port; there is nothing to press until readings are back.
    return (
      <p role="status" className="text-body text-ink-muted">
        Reconnecting… · check the cable
      </p>
    );
  }
  if (!connected) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" onClick={onConnect}>
          Connect a roaster
        </Button>
        <p className="text-label text-ink-muted">Pick a port or the Simulator in Settings.</p>
      </div>
    );
  }
  const step = flowStep(phase);
  const act = (action: RoastAction) => {
    run('roast.action-failed', async () => {
      const result = await api.roastAction(action);
      if (!result.ok) logger.info('roast.action-refused', { ...result.error });
    });
  };
  const hint =
    phase === 'cooling' && coolingLeftS !== undefined
      ? `${step.hint} ${formatClock(coolingLeftS)} left.`
      : step.hint;
  return (
    <div className="flex flex-col gap-2">
      {step.primary ? (
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            if (step.primary) act(step.primary.action);
          }}
        >
          {step.primary.label}
        </Button>
      ) : null}
      {/* The hint explains the primary action, so it sits right under it. */}
      <p className="text-label text-ink-muted">{hint}</p>
      {step.secondary ? (
        <Button
          variant={step.secondary.quiet ? 'ghost' : 'secondary'}
          onClick={() => {
            if (step.secondary) act(step.secondary.action);
          }}
        >
          {step.secondary.label}
        </Button>
      ) : null}
    </div>
  );
}
