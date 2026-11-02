import type { RoastAction } from '@roastpilot/shared';
import { Button, formatClock } from '@roastpilot/ui';
import { flowStep, isConnected } from '../lib/flow-step';
import { useRun } from '../hooks/use-run';
import { useAppState, useDeps } from '../state/app-context';

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
  const connected = useAppState((s) => isConnected(s.connection));
  const phase = useAppState((s) => s.roast.phase);
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
      {step.secondary ? (
        <Button
          onClick={() => {
            if (step.secondary) act(step.secondary.action);
          }}
        >
          {step.secondary.label}
        </Button>
      ) : null}
      <p className="text-label text-ink-muted">{hint}</p>
    </div>
  );
}
