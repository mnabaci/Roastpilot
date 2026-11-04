import type { RoastAction } from '@roastpilot/shared';
import { Button } from '@roastpilot/ui';
import { ConfirmInline } from '../../features/ConfirmInline';
import { flowHint, flowStep, isConnected } from './flow-step';
import { RoasterCooling } from './RoasterCooling';
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
  const roast = useRoast((s) => s.roast);
  const temp = useRoast((s) => s.readings.at(-1)?.values.bt);
  const { phase } = roast;
  const step = flowStep(roast);
  const act = (action: RoastAction) => {
    run('roast.action-failed', async () => {
      const result = await api.roastAction(action);
      if (!result.ok) logger.info('roast.action-refused', { ...result.error });
    });
  };
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
  const hint = flowHint(roast, { coolingLeftS, temp });
  const noRoast = phase === 'ready' || phase === 'done';
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
          variant="secondary"
          onClick={() => {
            if (step.secondary) act(step.secondary.action);
          }}
        >
          {step.secondary.label}
        </Button>
      ) : null}
      {noRoast ? <RoasterCooling onAction={act} /> : null}
      {step.quiet ? (
        <Button
          variant="ghost"
          onClick={() => {
            if (step.quiet) act(step.quiet.action);
          }}
        >
          {step.quiet.label}
        </Button>
      ) : null}
      {step.stop ? (
        <ConfirmInline
          key={phase}
          variant="secondary"
          label={step.stop.label}
          question={step.stop.question}
          confirmLabel={step.stop.label}
          onConfirm={() => {
            act('end');
          }}
          stacked
        />
      ) : null}
    </div>
  );
}
